/**
 * Comic Strip Card for Home Assistant
 * A generic Lovelace card that displays daily comic strips from any RSS feed.
 * Designed to work with https://comiccaster.xyz/ feeds.
 *
 * Repository: https://github.com/YOUR_USERNAME/comic-strip-card
 * License: MIT
 */

const CARD_VERSION = "1.0.0";

// ---------------------------------------------------------------------------
// Helper: derive a filesystem-safe slug from an RSS URL
//   https://comiccaster.xyz/rss/calvinandhobbes  ->  calvinandhobbes
//   https://example.com/feed/my-comic.xml        ->  my-comic
// ---------------------------------------------------------------------------
function slugFromUrl(url) {
  try {
    const pathname = new URL(url).pathname;
    const lastSegment = pathname.split("/").filter(Boolean).pop() || "comic";
    return lastSegment.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
  } catch {
    return "comic";
  }
}

// ---------------------------------------------------------------------------
// ComicStripCard — Main card element
// ---------------------------------------------------------------------------
class ComicStripCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = null;
    this._meta = null;
    this._error = null;
    this._loading = true;
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
    };
  }

  setConfig(config) {
    if (!config.rss_url) {
      throw new Error("Please set an rss_url in the card configuration.");
    }
    this._config = {
      rss_url: config.rss_url,
      title: config.title || "",
      show_title: config.show_title !== false,
      show_date: config.show_date !== false,
      card_style: config.card_style || "default",
    };
    this._slug = slugFromUrl(this._config.rss_url);
    this._basePath = `/local/community/comic-strip-card`;
    this._render();
    this._fetchMeta();
  }

  set hass(hass) {
    this._hass = hass;
  }

  getCardSize() {
    return 4;
  }

  // --- Data fetching ---
  async _fetchMeta() {
    const jsonUrl = `${this._basePath}/${this._slug}_data.json?_ts=${Date.now()}`;
    try {
      const resp = await fetch(jsonUrl, { cache: "no-store" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      this._meta = await resp.json();
      this._error = null;
      this._loading = false;
    } catch {
      this._meta = null;
      this._error = "no-data";
      this._loading = false;
    }
    this._render();
  }

  // --- Rendering ---
  _render() {
    const isMinimal = this._config.card_style === "minimal";
    const slug = this._slug || "comic";
    const cacheBuster = `?_d=${new Date().toISOString().slice(0, 10)}`;
    const imgSrc = `${this._basePath}/${slug}.png${cacheBuster}`;

    const title =
      this._config.title ||
      (this._meta && this._meta.title) ||
      slug.replace(/[-_]/g, " ");

    const dateStr =
      this._meta && this._meta.timestamp
        ? new Date(this._meta.timestamp).toLocaleDateString(undefined, {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : "";

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
          align-items: center;
          justify-content: space-between;
          padding: 16px 16px 8px 16px;
        }
        .card-title {
          font-size: 1.1em;
          font-weight: 600;
          color: var(--primary-text-color, #333);
          text-transform: capitalize;
          margin: 0;
          line-height: 1.3;
        }
        .card-date {
          font-size: 0.78em;
          color: var(--secondary-text-color, #888);
          margin: 0;
          line-height: 1.3;
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
            <div>
              <p class="card-title">${this._escHtml(title)}</p>
              ${this._config.show_date && dateStr ? `<p class="card-date">${this._escHtml(dateStr)}</p>` : ""}
            </div>
          </div>`
            : ""
        }
        <div class="card-content">
          ${this._renderBody(imgSrc)}
        </div>
      </ha-card>
    `;

    // Attach image load/error handlers
    const img = this.shadowRoot.querySelector(".comic-image");
    if (img) {
      img.addEventListener("error", () => {
        img.classList.add("error");
        const content = this.shadowRoot.querySelector(".card-content");
        if (content && !content.querySelector(".placeholder")) {
          content.innerHTML = this._renderPlaceholder();
        }
      });
    }
  }

  _renderBody(imgSrc) {
    if (this._loading) {
      return `
        <div class="loading">
          <div class="loading-spinner"></div>
        </div>`;
    }
    if (this._error === "no-data") {
      return this._renderPlaceholder();
    }
    return `<img class="comic-image" src="${imgSrc}" alt="Daily comic strip" crossorigin="anonymous" />`;
  }

  _renderPlaceholder() {
    return `
      <div class="placeholder">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
        <div class="msg">
          No comic strip loaded yet.<br/>
          Make sure the shell script has run at least once.
        </div>
        <div class="hint">
          RSS Feed: ${this._escHtml(this._config.rss_url || "not set")}
        </div>
      </div>`;
  }

  _escHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
}

// ---------------------------------------------------------------------------
// ComicStripCardEditor — Visual config editor
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
        input[type="text"] {
          padding: 8px 12px;
          border: 1px solid var(--divider-color, #ddd);
          border-radius: 8px;
          background: var(--card-background-color, #fff);
          color: var(--primary-text-color, #333);
          font-size: 0.92em;
          outline: none;
          transition: border-color 0.15s;
        }
        input[type="text"]:focus {
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
        /* Simple toggle switch */
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
          <div class="hint">Overrides the title from the RSS feed. Leave blank to use the feed title.</div>
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
              <span class="hint">Display the date the comic was fetched.</span>
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
  }

  _updateConfig(key, value) {
    this._config = { ...this._config, [key]: value };
    const event = new CustomEvent("config-changed", {
      detail: { config: this._config },
      bubbles: true,
      composed: true,
    });
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
customElements.define("comic-strip-card", ComicStripCard);
customElements.define("comic-strip-card-editor", ComicStripCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "comic-strip-card",
  name: "Comic Strip Card",
  description:
    "Display daily comic strips from any RSS feed (comiccaster.xyz and others).",
  preview: false,
  documentationURL: "https://github.com/YOUR_USERNAME/comic-strip-card",
});

console.info(
  `%c COMIC-STRIP-CARD %c v${CARD_VERSION} `,
  "color: white; background: #03a9f4; font-weight: bold; padding: 2px 6px; border-radius: 4px 0 0 4px;",
  "color: #03a9f4; background: #e3f2fd; font-weight: bold; padding: 2px 6px; border-radius: 0 4px 4px 0;"
);
