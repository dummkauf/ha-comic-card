import CardMockup from "@/components/card-mockup";
import EditorMockup from "@/components/editor-mockup";
import FileTree from "@/components/file-tree";

export default function Page() {
  return (
    <main className="min-h-screen bg-background">
      {/* Hero */}
      <header className="border-b border-border bg-card">
        <div className="max-w-3xl mx-auto px-6 py-16 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-5 h-5 text-primary-foreground"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
            <span className="text-xs font-medium text-muted-foreground bg-secondary px-2 py-1 rounded-md">
              HACS Lovelace
            </span>
          </div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight text-balance">
            Comic Strip Card
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed max-w-xl text-pretty">
            A generic HACS Lovelace card that displays the current daily comic
            strip from any RSS feed. Works with{" "}
            <a
              href="https://comiccaster.xyz/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              ComicCaster
            </a>{" "}
            and other comic RSS feeds. One card install, unlimited comics.
          </p>
          <div className="flex items-center gap-3 pt-2">
            <a
              href="https://github.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-4 h-4"
              >
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              View on GitHub
            </a>
            <a
              href="https://comiccaster.xyz/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-accent transition-colors"
            >
              Browse Comics
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-12 flex flex-col gap-16">
        {/* Features */}
        <section className="flex flex-col gap-6">
          <h2 className="text-xl font-semibold text-foreground">Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                title: "Any Comic Strip",
                desc: "Configure any RSS feed URL per card instance",
              },
              {
                title: "Multiple Comics",
                desc: "One installation, unlimited cards with different feeds",
              },
              {
                title: "Visual Editor",
                desc: "Configure from the HA dashboard UI, no YAML required",
              },
              {
                title: "Auto Theming",
                desc: "Inherits your Home Assistant theme colors automatically",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1.5"
              >
                <p className="text-sm font-medium text-foreground">{f.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Card Preview */}
        <section className="flex flex-col gap-6">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              Card Preview
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Mockup of how the card appears on your Home Assistant dashboard.
              The actual comic image loads from your local filesystem.
            </p>
          </div>
          <CardMockup />
        </section>

        {/* Editor Preview */}
        <section className="flex flex-col gap-6">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              Visual Config Editor
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Interactive preview of the card configuration editor. Try changing
              the settings below.
            </p>
          </div>
          <EditorMockup />
        </section>

        {/* Repository Structure */}
        <section className="flex flex-col gap-6">
          <h2 className="text-xl font-semibold text-foreground">
            Repository Structure
          </h2>
          <FileTree />
        </section>

        {/* Installation Steps */}
        <section className="flex flex-col gap-6">
          <h2 className="text-xl font-semibold text-foreground">
            Quick Start
          </h2>
          <div className="flex flex-col gap-4">
            {[
              {
                step: "1",
                title: "Install via HACS",
                desc: "Add as a custom repository (Dashboard category), then install.",
              },
              {
                step: "2",
                title: "Add Shell Commands",
                desc: "Add one shell_command per comic in configuration.yaml. Paths auto-detect from your repo folder name.",
              },
              {
                step: "3",
                title: "Create Automation",
                desc: "Set up a daily automation to fetch comics on a schedule.",
              },
              {
                step: "4",
                title: "Add Card to Dashboard",
                desc: "Use the visual editor or YAML to add cards to your Lovelace dashboard.",
              },
            ].map((s) => (
              <div
                key={s.step}
                className="flex items-start gap-4 rounded-xl border border-border bg-card p-4"
              >
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-primary-foreground">
                    {s.step}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium text-foreground">
                    {s.title}
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {s.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Comparison Table */}
        <section className="flex flex-col gap-6">
          <h2 className="text-xl font-semibold text-foreground">
            vs. calvin-card-ha
          </h2>
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary/50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">
                    Feature
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">
                    calvin-card-ha
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-primary">
                    Comic Strip Card
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  ["Comics supported", "Calvin & Hobbes only", "Any RSS feed"],
                  ["Config", "Hardcoded", "User-configurable"],
                  ["Visual editor", "No", "Yes"],
                  [
                    "Multiple comics",
                    "Multiple installs",
                    "One install, many cards",
                  ],
                  ["Shell script", "Hardcoded URL", "Parameterized"],
                ].map(([feature, old, current]) => (
                  <tr key={feature} className="bg-card">
                    <td className="px-4 py-3 text-foreground font-medium">
                      {feature}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{old}</td>
                    <td className="px-4 py-3 text-foreground">{current}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border pt-8 pb-4 flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">
            Inspired by{" "}
            <a
              href="https://github.com/Brianfit/calvin-card-ha"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              calvin-card-ha
            </a>{" "}
            by Brian Fitzgerald. Comic feeds powered by{" "}
            <a
              href="https://comiccaster.xyz/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              ComicCaster
            </a>
            .
          </p>
          <p className="text-xs text-muted-foreground">MIT License</p>
        </footer>
      </div>
    </main>
  );
}
