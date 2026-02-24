"use client";

import { useState } from "react";

export default function EditorMockup() {
  const [rssUrl, setRssUrl] = useState(
    "https://comiccaster.xyz/rss/calvinandhobbes"
  );
  const [title, setTitle] = useState("");
  const [showTitle, setShowTitle] = useState(true);
  const [showDate, setShowDate] = useState(true);
  const [cardStyle, setCardStyle] = useState("default");
  const [refreshInterval, setRefreshInterval] = useState(3600);
  const [corsProxy, setCorsProxy] = useState("");

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-secondary/50">
          <p className="text-sm font-medium text-foreground">
            Card Configuration
          </p>
          <p className="text-xs text-muted-foreground">
            Interactive preview of the visual editor (as seen in Home Assistant)
          </p>
        </div>
        <div className="p-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground">
              RSS Feed URL *
            </label>
            <input
              type="text"
              value={rssUrl}
              onChange={(e) => setRssUrl(e.target.value)}
              placeholder="https://comiccaster.xyz/rss/calvinandhobbes"
              className="px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm outline-none focus:border-primary transition-colors"
            />
            <p className="text-xs text-muted-foreground">
              Paste any comic RSS feed URL.{" "}
              <a
                href="https://comiccaster.xyz/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Browse comics at comiccaster.xyz
              </a>
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground">
              Title (optional)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Calvin and Hobbes"
              className="px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm outline-none focus:border-primary transition-colors"
            />
            <p className="text-xs text-muted-foreground">
              Overrides the title from the RSS feed. Leave blank to auto-detect.
            </p>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <label className="text-xs font-medium text-foreground">
                Show Title
              </label>
              <span className="text-xs text-muted-foreground">
                Display the comic name above the image.
              </span>
            </div>
            <button
              onClick={() => setShowTitle(!showTitle)}
              className={`relative w-11 h-6 rounded-full transition-colors ${showTitle ? "bg-primary" : "bg-muted"}`}
              aria-label="Toggle show title"
            >
              <span
                className={`absolute top-[3px] left-[3px] w-[18px] h-[18px] bg-primary-foreground rounded-full transition-transform ${showTitle ? "translate-x-5" : ""}`}
              />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <label className="text-xs font-medium text-foreground">
                Show Date
              </label>
              <span className="text-xs text-muted-foreground">
                Display the publication date from the RSS feed.
              </span>
            </div>
            <button
              onClick={() => setShowDate(!showDate)}
              className={`relative w-11 h-6 rounded-full transition-colors ${showDate ? "bg-primary" : "bg-muted"}`}
              aria-label="Toggle show date"
            >
              <span
                className={`absolute top-[3px] left-[3px] w-[18px] h-[18px] bg-primary-foreground rounded-full transition-transform ${showDate ? "translate-x-5" : ""}`}
              />
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground">
              Card Style
            </label>
            <select
              value={cardStyle}
              onChange={(e) => setCardStyle(e.target.value)}
              className="px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm outline-none"
            >
              <option value="default">Default (with padding)</option>
              <option value="minimal">Minimal (edge-to-edge)</option>
            </select>
          </div>

          <div className="border-t border-border my-1" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Advanced
          </p>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground">
              Refresh Interval (seconds)
            </label>
            <input
              type="number"
              value={refreshInterval}
              onChange={(e) =>
                setRefreshInterval(parseInt(e.target.value, 10) || 3600)
              }
              min={300}
              step={300}
              className="px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm outline-none focus:border-primary transition-colors"
            />
            <p className="text-xs text-muted-foreground">
              How often to re-fetch the RSS feed. Minimum 300s (5 min). Default
              3600s (1 hour).
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground">
              CORS Proxy (optional)
            </label>
            <input
              type="text"
              value={corsProxy}
              onChange={(e) => setCorsProxy(e.target.value)}
              placeholder="https://corsproxy.io/?{url}"
              className="px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm outline-none focus:border-primary transition-colors"
            />
            <p className="text-xs text-muted-foreground">
              Custom CORS proxy URL template. Use{" "}
              <code className="text-foreground bg-secondary px-1 rounded text-xs">
                {"{url}"}
              </code>{" "}
              as placeholder. Leave blank to use built-in proxies.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-secondary/30 overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <p className="text-sm font-medium text-foreground">Generated YAML</p>
        </div>
        <pre className="p-4 text-xs font-mono text-foreground overflow-x-auto leading-relaxed">
          {`type: custom:comic-strip-card
rss_url: ${rssUrl || "https://comiccaster.xyz/rss/calvinandhobbes"}${title ? `\ntitle: ${title}` : ""}
show_title: ${showTitle}
show_date: ${showDate}
card_style: ${cardStyle}${refreshInterval !== 3600 ? `\nrefresh_interval: ${refreshInterval}` : ""}${corsProxy ? `\ncors_proxy: "${corsProxy}"` : ""}`}
        </pre>
      </div>
    </div>
  );
}
