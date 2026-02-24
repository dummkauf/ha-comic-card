"use client";

import { useState } from "react";

const SAMPLE_COMICS = [
  {
    slug: "calvinandhobbes",
    title: "Calvin and Hobbes",
    date: new Date().toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
  },
  {
    slug: "garfield",
    title: "Garfield",
    date: new Date().toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
  },
  {
    slug: "peanuts",
    title: "Peanuts",
    date: new Date().toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
  },
];

function ComicCardMockup({
  title,
  date,
  minimal = false,
}: {
  title: string;
  date: string;
  minimal?: boolean;
}) {
  return (
    <div className="rounded-xl bg-card overflow-hidden shadow-sm border border-border">
      {!minimal && (
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div>
            <p className="text-sm font-semibold text-foreground capitalize">
              {title}
            </p>
            <p className="text-xs text-muted-foreground">{date}</p>
          </div>
        </div>
      )}
      <div className={minimal ? "p-0" : "px-4 pb-4"}>
        <div
          className={`w-full bg-secondary flex items-center justify-center ${minimal ? "" : "rounded-lg"}`}
          style={{ aspectRatio: "3 / 1", minHeight: 120 }}
        >
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-10 h-10 opacity-40"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <span className="text-xs opacity-60">
              Comic strip loads directly from RSS feed
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CardMockup() {
  const [activeStyle, setActiveStyle] = useState<"default" | "minimal">(
    "default"
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setActiveStyle("default")}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            activeStyle === "default"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground hover:bg-accent"
          }`}
        >
          Default Style
        </button>
        <button
          onClick={() => setActiveStyle("minimal")}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            activeStyle === "minimal"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground hover:bg-accent"
          }`}
        >
          Minimal Style
        </button>
      </div>
      <div className="flex flex-col gap-4">
        {SAMPLE_COMICS.map((comic) => (
          <ComicCardMockup
            key={comic.slug}
            title={comic.title}
            date={comic.date}
            minimal={activeStyle === "minimal"}
          />
        ))}
      </div>
    </div>
  );
}
