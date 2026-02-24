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

  const slug = rssUrl
    ? (() => {
        try {
          const p = new URL(rssUrl).pathname;
          return p.split("/").filter(Boolean).pop() || "comic";
        } catch {
          return "comic";
        }
      })()
    : "comic";

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-secondary/50">
          <p className="text-sm font-medium text-foreground">
            Card Configuration
          </p>
          <p className="text-xs text-muted-foreground">
            Visual editor preview (as seen in Home Assistant)
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
              Overrides the title from the RSS feed. Leave blank to use the feed
              title.
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
                Display the date the comic was fetched.
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
        </div>
      </div>

      <div className="rounded-xl border border-border bg-secondary/30 overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <p className="text-sm font-medium text-foreground">
            Generated YAML
          </p>
        </div>
        <pre className="p-4 text-xs font-mono text-foreground overflow-x-auto leading-relaxed">
          {`type: custom:comic-strip-card
rss_url: ${rssUrl || "https://comiccaster.xyz/rss/calvinandhobbes"}${title ? `\ntitle: ${title}` : ""}
show_title: ${showTitle}
show_date: ${showDate}
card_style: ${cardStyle}`}
        </pre>
      </div>

      <div className="rounded-xl border border-border bg-secondary/30 overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <p className="text-sm font-medium text-foreground">
            Shell Command (configuration.yaml)
          </p>
        </div>
        <pre className="p-4 text-xs font-mono text-foreground overflow-x-auto leading-relaxed">
          {`shell_command:
  fetch_comic_${slug}: >-
    /config/www/community/comic-card/comic-strip.sh
    ${rssUrl || "https://comiccaster.xyz/rss/calvinandhobbes"}`}
        </pre>
      </div>
    </div>
  );
}
