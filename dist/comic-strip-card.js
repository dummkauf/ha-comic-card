/**
 * Comic Strip Card for Home Assistant
 * A generic Lovelace card that displays daily comic strips from any RSS feed.
 * Fetches the RSS feed directly in the browser -- no shell script needed.
 * Designed to work with https://comiccaster.xyz/ feeds.
 *
 * License: MIT
 */

const CARD_VERSION = "2.4.0";

// ---------------------------------------------------------------------------
// CORS proxy helper
// Some RSS feeds (including comiccaster.xyz) may not include CORS headers.
// We try a direct fetch first, then fall back to a public CORS proxy.
// Users can also set a custom proxy in card config.
// ---------------------------------------------------------------------------
function cacheBust(url) {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}_t=${Date.now()}`;
}

const DEFAULT_CORS_PROXIES = [
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
];

async function fetchWithCorsFallback(url, customProxy) {
  const freshUrl = cacheBust(url);

  if (customProxy) {
    const proxied = customProxy.replace("{url}", encodeURIComponent(freshUrl));
    const resp = await fetch(cacheBust(proxied), { cache: "no-store" });
    if (resp.ok) return resp;
  }

  try {
    const resp = await fetch(freshUrl, { cache: "no-store" });
    if (resp.ok) return resp;
  } catch {
    // CORS or network error -- fall through to proxies
  }

  for (const proxyFn of DEFAULT_CORS_PROXIES) {
    try {
      const resp = await fetch(cacheBust(proxyFn(freshUrl)), { cache: "no-store" });
      if (resp.ok) return resp;
    } catch {
      continue;
    }
  }

  throw new Error(`Failed to fetch RSS feed: ${url}`);
}

// ---------------------------------------------------------------------------
// Image cache using IndexedDB (works in HA's webview; no size limits like
// the Cache API).  Stores one entry per RSS slug: { blob, metadata, timestamp }
// ---------------------------------------------------------------------------
const IMG_DB_NAME = "comic-strip-card-cache";
const IMG_DB_VERSION = 1;
const IMG_STORE = "images";

function openImageDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IMG_DB_NAME, IMG_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IMG_STORE)) {
        db.createObjectStore(IMG_STORE, { keyPath: "slug" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getCachedImage(slug) {
  try {
    const db = await openImageDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IMG_STORE, "readonly");
      const store = tx.objectStore(IMG_STORE);
      const req = store.get(slug);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function setCachedImage(slug, blob, metadata) {
  try {
    const db = await openImageDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IMG_STORE, "readwrite");
      const store = tx.objectStore(IMG_STORE);
      store.put({ slug, blob, metadata, timestamp: Date.now() });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Slug helper
// ---------------------------------------------------------------------------
function slugFromUrl(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
    let raw = parts[parts.length - 1] || u.hostname;
    raw = raw.replace(/\.[^.]+$/, "");
    return raw.replace(/[^a-z0-9]+/gi, "_").toLowerCase() || "comic";
  } catch {
    return "comic";
  }
}

// ---------------------------------------------------------------------------
// RSS parser
// ---------------------------------------------------------------------------
function parseRssFeed(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "text/xml");

  const channelTitle =
    doc.querySelector("channel > title")?.textContent?.trim() || "";

  const items = doc.querySelectorAll("item");
  if (items.length === 0) return { channelTitle, imageUrl: null, pubDate: null };

  let bestItem = items[0];
  let bestDate = -Infinity;

  for (const item of items) {
    const raw = item.querySelector("pubDate")?.textContent?.trim();
    if (raw) {
      const ts = new Date(raw).getTime();
      if (!isNaN(ts) && ts > bestDate) {
        bestDate = ts;
        bestItem = item;
      }
    }
  }

  const item = bestItem;
  const pubDate = item.querySelector("pubDate")?.textContent?.trim() || null;
  const itemTitle = item.querySelector("title")?.textContent?.trim() || "";

  let imageUrl = null;

  // Strategy 1: <enclosure>
  const enclosure = item.querySelector("enclosure");
  if (enclosure) {
    const encType = enclosure.getAttribute("type") || "";
    const encUrl = enclosure.getAttribute("url") || "";
    if (encUrl && (encType.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg)/i.test(encUrl))) {
      imageUrl = encUrl;
    }
  }

  // Strategy 2: <media:content>
  if (!imageUrl) {
    const mediaContent = item.getElementsByTagNameNS("http://search.yahoo.com/mrss/", "content");
    if (mediaContent.length > 0) {
      const mcUrl = mediaContent[0].getAttribute("url") || "";
      const mcType = mediaContent[0].getAttribute("type") || mediaContent[0].getAttribute("medium") || "";
      if (mcUrl && (mcType.includes("image") || /\.(png|jpe?g|gif|webp|svg)/i.test(mcUrl))) {
        imageUrl = mcUrl;
      }
    }
    if (!imageUrl) {
      const mcFallback = item.querySelectorAll("[url]");
      for (const el of mcFallback) {
        if (el.tagName.toLowerCase().includes("content") || el.tagName.toLowerCase().includes("thumbnail")) {
          const u = el.getAttribute("url") || "";
          if (u && /\.(png|jpe?g|gif|webp|svg)/i.test(u)) {
            imageUrl = u;
            break;
          }
        }
      }
    }
  }

  // Strategy 3: <img> in <description>
  if (!imageUrl) {
    let descHtml =
      item.querySelector("description")?.textContent ||
      item.querySelector("description")?.innerHTML ||
      "";
    descHtml = descHtml.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
    const imgMatch = descHtml.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch && imgMatch[1]) {
      imageUrl = imgMatch[1];
    }
  }

  // Strategy 4: <content:encoded>
  if (!imageUrl) {
    const contentEncoded = item.getElementsByTagNameNS("http://purl.org/rss/1.0/modules/content/", "encoded");
    if (contentEncoded.length > 0) {
      const html = contentEncoded[0].textContent || "";
      const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (imgMatch && imgMatch[1]) {
        imageUrl = imgMatch[1];
      }
    }
  }

  return { channelTitle, itemTitle, imageUrl, pubDate };
}

// ---------------------------------------------------------------------------
// ComicStripCard -- Main card element
// ---------------------------------------------------------------------------
class ComicStripCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = null;
    this._feedData = null;
    this._error = null;
    this._loading = true;
    this._cachedBlobUrl = null; // object URL for cached image blob
    this._lastFetchDate = null;
  }

  // --- HA lifecycle ---
  static getConfigElement() {
    return document.createElement("comic-strip-card-editor");
  }

  static getStubConfig() {
    return {
      rss_url: "https://comiccaster.xyz/rss/calvinandhobbes",
      title: "",
      show_title: true,
      show_date: true,
      card_style: "default",
      cors_proxy: "",
      refresh_interval: 1,
    };
  }

  setConfig(config) {
    const oldUrl = this._config.rss_url;
    this._config = {
      rss_url: config.rss_url || "",
      title: config.title || "",
      show_title: config.show_title !== false,
      show_date: config.show_date !== false,
      card_style: config.card_style || "default",
      cors_proxy: config.cors_proxy || "",
      refresh_interval: config.refresh_interval || 1,
    };

    if (!this._config.rss_url) {
      this._loading = false;
      this._error = null;
      this._feedData = null;
      this._render();
      return;
    }

    if (oldUrl !== this._config.rss_url || !this._feedData) {
      this._loading = true;
      this._error = null;
      this._feedData = null;
      this._render();
      this._loadComic();
    } else {
      this._render();
    }

    this._setupRefreshTimer();
  }

  set hass(hass) {
    this._hass = hass;
  }

  getCardSize() {
    return 4;
  }

  connectedCallback() {
    this._setupRefreshTimer();
  }

  disconnectedCallback() {
    if (this._refreshTimer) {
      clearInterval(this._refreshTimer);
      this._refreshTimer = null;
    }
    if (this._staleRetryTimer) {
      clearTimeout(this._staleRetryTimer);
      this._staleRetryTimer = null;
    }
    // Revoke any blob URL to avoid memory leaks
    if (this._cachedBlobUrl) {
      URL.revokeObjectURL(this._cachedBlobUrl);
      this._cachedBlobUrl = null;
    }
  }

  _setupRefreshTimer() {
    if (this._refreshTimer) {
      clearInterval(this._refreshTimer);
    }
    const intervalHours = Math.max(0.25, this._config.refresh_interval || 1);
    this._refreshTimer = setInterval(() => {
      this._fetchAndCacheFeed();
    }, intervalHours * 3600 * 1000);
  }

  // --- Load comic: check cache first, then fetch if stale ---
  async _loadComic() {
    const slug = slugFromUrl(this._config.rss_url);
    const cached = await getCachedImage(slug);

    if (cached && cached.blob && cached.metadata) {
      const ageHours = (Date.now() - cached.timestamp) / (3600 * 1000);
      const maxAge = Math.max(0.25, this._config.refresh_interval || 1);

      // Show cached image immediately
      if (this._cachedBlobUrl) URL.revokeObjectURL(this._cachedBlobUrl);
      this._cachedBlobUrl = URL.createObjectURL(cached.blob);
      this._feedData = cached.metadata;
      this._error = null;
      this._loading = false;
      this._render();

      // If cache is stale, refresh in the background
      if (ageHours >= maxAge) {
        this._fetchAndCacheFeed();
      }
      return;
    }

    // No cache -- fetch from network
    await this._fetchAndCacheFeed();
  }

  // --- Fetch RSS, download image, store in cache, then render ---
  async _fetchAndCacheFeed() {
    try {
      const resp = await fetchWithCorsFallback(
        this._config.rss_url,
        this._config.cors_proxy || null
      );
      const xmlText = await resp.text();
      const data = parseRssFeed(xmlText);

      if (!data.imageUrl) {
        this._error = "no-image";
        this._feedData = data;
        this._loading = false;
        this._render();
        return;
      }

      // Download the actual comic image as a blob
      let imageBlob = null;
      try {
        const imgResp = await fetchWithCorsFallback(
          data.imageUrl,
          this._config.cors_proxy || null
        );
        imageBlob = await imgResp.blob();
      } catch {
        // Image download failed -- still show from URL directly
      }

      if (imageBlob && imageBlob.size > 0) {
        // Store in IndexedDB cache
        const slug = slugFromUrl(this._config.rss_url);
        const metadata = {
          channelTitle: data.channelTitle,
          itemTitle: data.itemTitle,
          imageUrl: data.imageUrl,
          pubDate: data.pubDate,
        };
        await setCachedImage(slug, imageBlob, metadata);

        // Create blob URL for display
        if (this._cachedBlobUrl) URL.revokeObjectURL(this._cachedBlobUrl);
        this._cachedBlobUrl = URL.createObjectURL(imageBlob);
        this._feedData = metadata;
      } else {
        // Couldn't download image blob -- fall back to direct URL
        this._cachedBlobUrl = null;
        this._feedData = data;
      }

      this._error = null;
      this._lastFetchDate = new Date();
      this._loading = false;
      this._scheduleStaleRetry();
    } catch (err) {
      // Network error -- if we have a cached version, keep showing it
      if (!this._feedData) {
        this._error = err.message || "fetch-failed";
      }
      this._loading = false;
    }
    this._render();
  }

  _scheduleStaleRetry() {
    if (this._staleRetryTimer) clearTimeout(this._staleRetryTimer);
    if (!this._feedData || !this._feedData.pubDate) return;

    const pubDate = new Date(this._feedData.pubDate);
    const now = new Date();
    const pubDay = new Date(Date.UTC(pubDate.getUTCFullYear(), pubDate.getUTCMonth(), pubDate.getUTCDate()));
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    if (pubDay < today) {
      this._staleRetryCount = (this._staleRetryCount || 0) + 1;
      if (this._staleRetryCount <= 6) {
        this._staleRetryTimer = setTimeout(() => {
          this._fetchAndCacheFeed();
        }, 5 * 60 * 1000);
      }
    } else {
      this._staleRetryCount = 0;
    }
  }

  // --- Rendering ---
  _render() {
    const isMinimal = this._config.card_style === "minimal";

    const title =
      this._config.title ||
      (this._feedData && this._feedData.channelTitle) ||
      (this._feedData && this._feedData.itemTitle) ||
      "Comic Strip";

    let dateStr = "";
    if (this._feedData && this._feedData.pubDate) {
      try {
        const pubDate = new Date(this._feedData.pubDate);
        dateStr = pubDate.toLocaleDateString(undefined, {
          weekday: "short",
          year: "numeric",
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        });
      } catch {
        dateStr = this._feedData.pubDate;
      }
    }

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        ha-card {
          overflow: hidden;
          border-radius: var(--ha-card-border-radius, 12px);
          background: var(--ha-card-background, var(--card-background-color, #fff));
          box-shadow: var(--ha-card-box-shadow, none);
        }
        .card-header {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          padding: 12px 16px 6px 16px;
          gap: 8px;
        }
        .card-title {
          font-size: 0.85em;
          font-weight: 600;
          color: var(--primary-text-color, #333);
          text-transform: capitalize;
          margin: 0;
          line-height: 1.3;
          white-space: nowrap;
        }
        .card-date {
          font-size: 0.78em;
          color: var(--secondary-text-color, #888);
          margin: 0;
          line-height: 1.3;
          white-space: nowrap;
        }
        .card-content {
          padding: ${isMinimal ? "0" : "0 16px 16px 16px"};
        }
        .comic-image {
          width: 100%;
          height: auto;
          display: block;
          border-radius: ${isMinimal ? "0" : "8px"};
          background: var(--secondary-background-color, #f5f5f5);
          min-height: 120px;
        }
        .comic-image.error {
          display: none;
        }
        .placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 24px;
          text-align: center;
          color: var(--secondary-text-color, #888);
          gap: 12px;
        }
        .placeholder svg {
          width: 48px;
          height: 48px;
          opacity: 0.4;
        }
        .placeholder .msg {
          font-size: 0.92em;
          line-height: 1.5;
          max-width: 320px;
        }
        .placeholder .hint {
          font-size: 0.78em;
          opacity: 0.7;
        }
        .loading {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 48px 24px;
          color: var(--secondary-text-color, #888);
        }
        .loading-spinner {
          width: 24px;
          height: 24px;
          border: 3px solid var(--divider-color, #ddd);
          border-top-color: var(--primary-color, #03a9f4);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      </style>
      <ha-card>
        ${
          this._config.show_title && !isMinimal
            ? `
          <div class="card-header">
              <p class="card-title">${this._escHtml(title)}</p>
              ${this._config.show_date && dateStr ? `<p class="card-date">${this._escHtml(dateStr)}</p>` : ""}
          </div>`
            : ""
        }
        <div class="card-content">
          ${this._renderBody()}
        </div>
      </ha-card>
    `;

    const img = this.shadowRoot.querySelector(".comic-image");
    if (img) {
      img.addEventListener("error", () => {
        img.classList.add("error");
        const content = this.shadowRoot.querySelector(".card-content");
        if (content && !content.querySelector(".placeholder")) {
          content.innerHTML = this._renderPlaceholder(
            "Could not load the comic image.",
            "The image URL may be broken or blocked."
          );
        }
      });
    }
  }

  _renderBody() {
    if (!this._config.rss_url) {
      return this._renderPlaceholder(
        "No RSS feed configured.",
        "Open the card editor and paste an RSS feed URL from comiccaster.xyz or another comic RSS source."
      );
    }

    if (this._loading) {
      return `
        <div class="loading">
          <div class="loading-spinner"></div>
        </div>`;
    }

    if (this._error === "fetch-failed" || (this._error && !this._feedData)) {
      return this._renderPlaceholder(
        "Could not fetch the RSS feed.",
        "Check the feed URL or try adding a CORS proxy in the card config."
      );
    }

    if (this._error === "no-image") {
      return this._renderPlaceholder(
        "No comic image found in the RSS feed.",
        "The feed may use an unsupported format."
      );
    }

    // Prefer cached blob URL; fall back to remote URL
    const imgSrc = this._cachedBlobUrl || (this._feedData && this._feedData.imageUrl) || "";
    return `<img class="comic-image" src="${this._escHtml(imgSrc)}" alt="Daily comic strip" crossorigin="anonymous" referrerpolicy="no-referrer" />`;
  }

  _renderPlaceholder(msg, hint) {
    return `
      <div class="placeholder">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
        <div class="msg">${msg || "No comic strip loaded yet."}</div>
        <div class="hint">${hint || `RSS: ${this._escHtml(this._config.rss_url || "not set")}`}</div>
      </div>`;
  }

  _escHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
}

// ---------------------------------------------------------------------------
// ComicStripCardEditor -- Visual config editor
// ---------------------------------------------------------------------------
class ComicStripCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
  }

  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  _render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        .form {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 16px 0;
        }
        .field {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        label {
          font-size: 0.88em;
          font-weight: 500;
          color: var(--primary-text-color, #333);
        }
        .hint {
          font-size: 0.76em;
          color: var(--secondary-text-color, #888);
          margin-top: 2px;
        }
        input[type="text"], input[type="number"] {
          padding: 8px 12px;
          border: 1px solid var(--divider-color, #ddd);
          border-radius: 8px;
          background: var(--card-background-color, #fff);
          color: var(--primary-text-color, #333);
          font-size: 0.92em;
          outline: none;
          transition: border-color 0.15s;
        }
        input[type="text"]:focus, input[type="number"]:focus {
          border-color: var(--primary-color, #03a9f4);
        }
        input[type="text"]::placeholder {
          color: var(--secondary-text-color, #aaa);
        }
        .toggle-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .toggle-label {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        select {
          padding: 8px 12px;
          border: 1px solid var(--divider-color, #ddd);
          border-radius: 8px;
          background: var(--card-background-color, #fff);
          color: var(--primary-text-color, #333);
          font-size: 0.92em;
          outline: none;
        }
        .switch {
          position: relative;
          width: 44px;
          height: 24px;
          flex-shrink: 0;
        }
        .switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }
        .slider {
          position: absolute;
          inset: 0;
          background: var(--divider-color, #ccc);
          border-radius: 24px;
          cursor: pointer;
          transition: background 0.2s;
        }
        .slider::before {
          content: "";
          position: absolute;
          width: 18px;
          height: 18px;
          left: 3px;
          bottom: 3px;
          background: #fff;
          border-radius: 50%;
          transition: transform 0.2s;
        }
        .switch input:checked + .slider {
          background: var(--primary-color, #03a9f4);
        }
        .switch input:checked + .slider::before {
          transform: translateX(20px);
        }
        .browse-link {
          font-size: 0.8em;
          color: var(--primary-color, #03a9f4);
          text-decoration: none;
        }
        .browse-link:hover {
          text-decoration: underline;
        }
        .divider {
          border-top: 1px solid var(--divider-color, #eee);
          margin: 4px 0;
        }
        .section-label {
          font-size: 0.76em;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--secondary-text-color, #888);
          margin-top: 4px;
        }
      </style>
      <div class="form">
        <div class="field">
          <label for="rss_url">RSS Feed URL *</label>
          <input
            type="text"
            id="rss_url"
            value="${this._escAttr(this._config.rss_url || "")}"
            placeholder="https://comiccaster.xyz/rss/calvinandhobbes"
          />
          <div class="hint">
            Paste any comic RSS feed URL.
            <a class="browse-link" href="https://comiccaster.xyz/" target="_blank" rel="noopener">Browse comics at comiccaster.xyz</a>
          </div>
        </div>
        <div class="field">
          <label for="title">Title (optional)</label>
          <input
            type="text"
            id="title"
            value="${this._escAttr(this._config.title || "")}"
            placeholder="e.g. Calvin and Hobbes"
          />
          <div class="hint">Overrides the title from the RSS feed. Leave blank to auto-detect.</div>
        </div>
        <div class="field">
          <div class="toggle-row">
            <div class="toggle-label">
              <label>Show Title</label>
              <span class="hint">Display the comic name and date above the image.</span>
            </div>
            <label class="switch">
              <input type="checkbox" id="show_title" ${this._config.show_title !== false ? "checked" : ""} />
              <span class="slider"></span>
            </label>
          </div>
        </div>
        <div class="field">
          <div class="toggle-row">
            <div class="toggle-label">
              <label>Show Date</label>
              <span class="hint">Display the publication date from the RSS feed.</span>
            </div>
            <label class="switch">
              <input type="checkbox" id="show_date" ${this._config.show_date !== false ? "checked" : ""} />
              <span class="slider"></span>
            </label>
          </div>
        </div>
        <div class="field">
          <label for="card_style">Card Style</label>
          <select id="card_style">
            <option value="default" ${this._config.card_style !== "minimal" ? "selected" : ""}>Default (with padding)</option>
            <option value="minimal" ${this._config.card_style === "minimal" ? "selected" : ""}>Minimal (edge-to-edge)</option>
          </select>
        </div>

        <div class="divider"></div>
        <div class="section-label">Advanced</div>

        <div class="field">
          <label for="refresh_interval">Refresh Interval (hours)</label>
          <input
            type="number"
            id="refresh_interval"
            value="${this._config.refresh_interval || 1}"
            min="0.25"
            step="0.25"
          />
          <div class="hint">How often to re-fetch the RSS feed. Minimum 0.25 hours (15 min). Default 1 hour.</div>
        </div>
        <div class="field">
          <label for="cors_proxy">CORS Proxy (optional)</label>
          <input
            type="text"
            id="cors_proxy"
            value="${this._escAttr(this._config.cors_proxy || "")}"
            placeholder="https://corsproxy.io/?{url}"
          />
          <div class="hint">
            Custom CORS proxy template. Use <code>{url}</code> as placeholder for the encoded feed URL.
            Leave blank to use built-in proxies.
          </div>
        </div>
      </div>
    `;

    // Bind events
    this.shadowRoot.querySelector("#rss_url").addEventListener("input", (e) => {
      this._updateConfig("rss_url", e.target.value);
    });
    this.shadowRoot.querySelector("#title").addEventListener("input", (e) => {
      this._updateConfig("title", e.target.value);
    });
    this.shadowRoot
      .querySelector("#show_title")
      .addEventListener("change", (e) => {
        this._updateConfig("show_title", e.target.checked);
      });
    this.shadowRoot
      .querySelector("#show_date")
      .addEventListener("change", (e) => {
        this._updateConfig("show_date", e.target.checked);
      });
    this.shadowRoot
      .querySelector("#card_style")
      .addEventListener("change", (e) => {
        this._updateConfig("card_style", e.target.value);
      });
    this.shadowRoot
      .querySelector("#refresh_interval")
      .addEventListener("change", (e) => {
        this._updateConfig("refresh_interval", parseFloat(e.target.value) || 1);
      });
    this.shadowRoot
      .querySelector("#cors_proxy")
      .addEventListener("input", (e) => {
        this._updateConfig("cors_proxy", e.target.value);
      });
  }

  _updateConfig(key, value) {
    this._config = { ...this._config, [key]: value };
    const event = new Event("config-changed", {
      bubbles: true,
      composed: true,
    });
    event.detail = { config: { ...this._config } };
    this.dispatchEvent(event);
  }

  _escAttr(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
}

// ---------------------------------------------------------------------------
// Register elements
// ---------------------------------------------------------------------------
customElements.define("comic-strip-card-editor", ComicStripCardEditor);
customElements.define("comic-strip-card", ComicStripCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "comic-strip-card",
  name: "Comic Strip Card",
  description:
    "Display daily comic strips from any RSS feed (comiccaster.xyz and others). Images cached locally in the browser for fast dashboard loads.",
  preview: false,
});

console.info(
  `%c COMIC-STRIP-CARD %c v${CARD_VERSION} `,
  "color: white; background: #03a9f4; font-weight: bold; padding: 2px 6px; border-radius: 4px 0 0 4px;",
  "color: #03a9f4; background: #e3f2fd; font-weight: bold; padding: 2px 6px; border-radius: 0 4px 4px 0;"
);
