export default function FileTree() {
  const files = [
    { name: "hacs.json", indent: 0, desc: "HACS manifest" },
    { name: "dist/", indent: 0, desc: "" },
    {
      name: "comic-strip-card.js",
      indent: 1,
      desc: "Card + visual editor",
    },
    { name: "comic-strip.sh", indent: 1, desc: "RSS fetch script" },
    { name: "LICENSE", indent: 0, desc: "MIT" },
    { name: "README.md", indent: 0, desc: "Documentation" },
  ];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-secondary/50">
        <p className="text-sm font-medium text-foreground">
          Repository Structure
        </p>
      </div>
      <div className="p-4 font-mono text-sm flex flex-col gap-1">
        {files.map((f, i) => (
          <div
            key={i}
            className="flex items-center gap-2"
            style={{ paddingLeft: f.indent * 20 }}
          >
            <span className="text-muted-foreground">
              {f.name.endsWith("/") ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-4 h-4"
                >
                  <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-4 h-4"
                >
                  <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                  <path d="M14 2v4a2 2 0 0 0 2 2h4" />
                </svg>
              )}
            </span>
            <span className="text-foreground">{f.name}</span>
            {f.desc && (
              <span className="text-xs text-muted-foreground">
                {"-- "}
                {f.desc}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
