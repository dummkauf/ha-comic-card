/**
 * Comic Strip Card for Home Assistant
 * A generic Lovelace card that displays daily comic strips from any RSS feed.
 * Fetches the RSS feed directly in the browser -- no shell script needed.
 * Designed to work with https://comiccaster.xyz/ feeds.
 *
 * License: MIT
 */

const CARD_VERSION = "2.2.0";

// ---------------------------------------------------------------------------
// CORS proxy helper
// Some RSS feeds (including comiccaster.xyz) may not include CORS headers.
// We try a direct fetch first, then fall back to a public CORS proxy.
// Users can also set a custom proxy in card config.
// ---------------------------------------------------------------------------
// Append a cache-busting parameter to a URL.  This defeats both browser
// caching AND server-side caching on public CORS proxies (allorigins,
// corsproxy.io, etc.) which key their cache on the full request URL.
function cacheBust(url) {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}_t=${Date.now()}`;
}

const DEFAULT_CORS_PROXIES = [
  // Each proxy receives the cache-busted source URL so the proxy itself
  // also sees a fresh, uncached request.
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
];

async function fetchWithCorsFallback(url, customProxy) {
  const freshUrl = cacheBust(url);

  // If the user provided a custom proxy URL template, try that first
  if (customProxy) {
    const proxied = customProxy.replace("{url}", encodeURIComponent(freshUrl));
    const resp = await fetch(cacheBust(proxied), { cache: "no-store" });
    if (resp.ok) return resp;
  }

  // Try direct fetch first (works if the feed server allows CORS)
  try {
    const resp = await fetch(freshUrl, { cache: "no-store" });
    if (resp.ok) return resp;
  } catch {
    // CORS or network error -- fall through to proxies
  }

  // Try each public proxy in order
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
// RSS parser: extract the best (most recent) item's image URL and metadata.
// Handles <img> in description, <enclosure>, and <media:content>.
//
// Feed items are typically newest-first, but we don't assume that.
// We parse ALL items, pick the one with the most recent pubDate, and
// return it.  This ensures we always show today's strip when available,
// even if the feed order is unexpected.
// ---------------------------------------------------------------------------
function parseRssFeed(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "text/xml");

  // Channel-level title (fallback for card title)
  const channelTitle =
    doc.querySelector("channel > title")?.textContent?.trim() || "";

  const items = doc.querySelectorAll("item");
  if (items.length === 0) return { channelTitle, imageUrl: null, pubDate: null };

  // Parse all items and pick the one with the newest pubDate.
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

  // Strategy 1: Look for <enclosure> with an image type
  const enclosure = item.querySelector("enclosure");
  if (enclosure) {
    const encType = enclosure.getAttribute("type") || "";
    const encUrl = enclosure.getAttribute("url") || "";
    if (encUrl && (encType.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg)/i.test(encUrl))) {
      imageUrl = encUrl;
    }
  }

  // Strategy 2: Look for <media:content> (namespace-aware and fallback)
  if (!imageUrl) {
    // Try namespace-aware first
    const mediaContent = item.getElementsByTagNameNS(
      "http://search.yahoo.com/mrss/",
      "content"
    );
    if (mediaContent.length > 0) {
      const mcUrl = mediaContent[0].getAttribute("url") || "";
      const mcType = mediaContent[0].getAttribute("type") || mediaContent[0].getAttribute("medium") || "";
      if (mcUrl && (mcType.includes("image") || /\.(png|jpe?g|gif|webp|svg)/i.test(mcUrl))) {
        imageUrl = mcUrl;
      }
    }
    // Fallback: try without namespace (some feeds use <media:content> without declaring the NS)
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

  // Strategy 3: Parse <description> HTML for <img> tags
  if (!imageUrl) {
    let descHtml =
      item.querySelector("description")?.textContent ||
      item.querySelector("description")?.innerHTML ||
      "";

    // Handle CDATA: the text content should already be unwrapped, but just in case
    descHtml = descHtml.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");

    // Find img src
    const imgMatch = descHtml.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch && imgMatch[1]) {
      imageUrl = imgMatch[1];
    }
  }

  // Strategy 4: Look for image URL anywhere in the item content
  if (!imageUrl) {
    const contentEncoded = item.getElementsByTagNameNS(
      "http://purl.org/rss/1.0/modules/content/",
      "encoded"
    );
    if (contentEncoded.length > 0) {
      const html = contentEncoded[0].textContent || "";
      const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (imgMatch && imgMatch[1]) {
        imageUrl = imgMatch[1];
      }
    }
  }

  return {
    channelTitle,
    itemTitle,
    imageUrl,
    pubDate,
  };
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
    this._lastFetchDate = null; // track the date of the last successful fetch
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
    // Don't throw on missing rss_url -- show a friendly placeholder instead.
    // Throwing here breaks the visual editor and the card picker.
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

    // If no RSS URL is configured, show the setup placeholder
    if (!this._config.rss_url) {
      this._loading = false;
      this._error = null;
      this._feedData = null;
      this._render();
      return;
    }

    // Only re-fetch if the RSS URL changed or we haven't fetched yet
    if (oldUrl !== this._config.rss_url || !this._feedData) {
      this._loading = true;
      this._error = null;
      this._feedData = null;
      this._render();
      this._fetchFeed();
    } else {
      this._render();
    }

    // Set up auto-refresh
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
  }

  _setupRefreshTimer() {
    if (this._refreshTimer) {
      clearInterval(this._refreshTimer);
    }
    const intervalHours = Math.max(0.25, this._config.refresh_interval || 1);
    this._refreshTimer = setInterval(() => {
      this._fetchFeed();
    }, intervalHours * 3600 * 1000);
  }

  // --- Data fetching ---
  async _fetchFeed() {
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
      } else {
        this._error = null;
        this._feedData = data;
        this._lastFetchDate = new Date();
      }
      this._loading = false;

      // If the newest strip is from before today (local time), the feed
      // hasn't been updated yet.  Schedule a short retry (5 min) so we
      // pick up today's strip as soon as the feed publishes it, rather
      // than waiting for the full refresh_interval.
      this._scheduleStaleRetry();
    } catch (err) {
      this._error = err.message || "fetch-failed";
      this._loading = false;
    }
    this._render();
  }

  _scheduleStaleRetry() {
    if (this._staleRetryTimer) clearTimeout(this._staleRetryTimer);

    if (!this._feedData || !this._feedData.pubDate) return;

    const pubDate = new Date(this._feedData.pubDate);
    const now = new Date();

    // Compare calendar dates in UTC (feeds use UTC midnight for pubDate)
    const pubDay = new Date(Date.UTC(pubDate.getUTCFullYear(), pubDate.getUTCMonth(), pubDate.getUTCDate()));
    const today  = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    if (pubDay < today) {
      // Strip is stale -- retry in 5 minutes (max 6 retries = 30 min)
      this._staleRetryCount = (this._staleRetryCount || 0) + 1;
      if (this._staleRetryCount <= 6) {
        this._staleRetryTimer = setTimeout(() => {
          this._fetchFeed();
        }, 5 * 60 * 1000); // 5 minutes
      }
    } else {
      // Strip is current, reset retry count
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
        // Format in UTC so "Tue, 24 Feb 2026 00:00:00 +0000" stays Feb 24
        // and doesn't shift to Feb 23 in western timezones.
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

    // Attach image error handler -- if the remote image fails, show placeholder
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

    const imgUrl = this._feedData.imageUrl;
    return `<img class="comic-image" src="${this._escHtml(imgUrl)}" alt="Daily comic strip" crossorigin="anonymous" referrerpolicy="no-referrer" />`;
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
          <div class="hint">How often to re-fetch the RSS feed. Minimum 300s (5 min). Default 3600s (1 hour).</div>
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
    // Use the exact event dispatch pattern from the HA developer docs:
    // new Event() with detail assigned separately, bubbles + composed.
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
// IMPORTANT: The editor MUST be registered before the card.
// When HA calls ComicStripCard.getConfigElement(), it does
// document.createElement("comic-strip-card-editor") which requires
// the editor custom element to already be defined.
// ---------------------------------------------------------------------------
customElements.define("comic-strip-card-editor", ComicStripCardEditor);
customElements.define("comic-strip-card", ComicStripCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "comic-strip-card",
  name: "Comic Strip Card",
  description:
    "Display daily comic strips from any RSS feed (comiccaster.xyz and others). No shell scripts required.",
  preview: false,
});

console.info(
  `%c COMIC-STRIP-CARD %c v${CARD_VERSION} `,
  "color: white; background: #03a9f4; font-weight: bold; padding: 2px 6px; border-radius: 4px 0 0 4px;",
  "color: #03a9f4; background: #e3f2fd; font-weight: bold; padding: 2px 6px; border-radius: 0 4px 4px 0;"
);
