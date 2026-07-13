import type { ReactNode } from "react";

export function PolicyPage({
  title,
  effective,
  intro,
  children,
}: {
  title: string;
  effective?: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <article className="container-app py-12 md:py-16 max-w-4xl">
      <header className="text-center">
        <p className="text-xs uppercase tracking-[0.25em] text-primary">Policy</p>
        <h1 className="font-display text-4xl md:text-5xl mt-2">{title}</h1>
        {effective && <p className="text-xs text-muted-foreground mt-3">{effective}</p>}
        {intro && <p className="text-foreground/80 mt-5 leading-relaxed max-w-2xl mx-auto">{intro}</p>}
      </header>

      <div className="mt-10 bg-card border border-border rounded-2xl p-6 md:p-10 premium-shadow space-y-2">
        {children}
      </div>

      <footer className="text-center mt-8 text-xs text-muted-foreground">
        Shri Radha Govind Store · 155, 2nd Floor, Madan Mohan Ghera, Vrindavan, Mathura, UP – 281121
      </footer>
    </article>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="py-4 border-b border-border/70 last:border-0">
      <h2 className="font-display text-xl md:text-2xl text-primary mb-3">{title}</h2>
      <div className="text-sm md:text-base text-foreground/85 leading-relaxed space-y-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2 [&_a]:text-primary [&_a]:hover:underline">
        {children}
      </div>
    </section>
  );
}

export function PolicyText({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/);

  return (
    <div className="space-y-5 text-sm md:text-base text-foreground/85 leading-relaxed">
      {blocks.map((block, index) => {
        const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
        const first = lines[0] ?? "";
        const isSectionTitle = /^\d+\.\s/.test(first);

        if (isSectionTitle) {
          return (
            <section key={index} className="border-b border-border/70 pb-5 last:border-0">
              <h2 className="font-display text-xl md:text-2xl text-primary mb-3">{first}</h2>
              <div className="space-y-2">
                {lines.slice(1).map((line, lineIndex) => (
                  <p key={lineIndex}>{line}</p>
                ))}
              </div>
            </section>
          );
        }

        return (
          <div key={index} className="space-y-2">
            {lines.map((line, lineIndex) => (
              <p key={lineIndex}>{line}</p>
            ))}
          </div>
        );
      })}
    </div>
  );
}
