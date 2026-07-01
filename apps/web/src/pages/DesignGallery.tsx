import { Button } from "../components/Button/index.js";
import { Card } from "../components/Card/index.js";
import { Input } from "../components/Input/index.js";
import { Textarea } from "../components/Input/index.js";
import { Surface } from "../components/Surface/index.js";
import styles from "./DesignGallery.module.css";

const WARM_SWATCHES = [
  { name: "warm-50", value: "oklch(0.97 0.012 70)" },
  { name: "warm-100", value: "oklch(0.93 0.018 70)" },
  { name: "warm-200", value: "oklch(0.85 0.022 70)" },
  { name: "warm-300", value: "oklch(0.72 0.025 70)" },
  { name: "warm-400", value: "oklch(0.58 0.025 70)" },
  { name: "warm-500", value: "oklch(0.45 0.020 70)" },
  { name: "warm-600", value: "oklch(0.36 0.020 65)" },
  { name: "warm-700", value: "oklch(0.30 0.022 60)" },
  { name: "warm-800", value: "oklch(0.25 0.022 60)" },
  { name: "warm-850", value: "oklch(0.22 0.020 60)" },
  { name: "warm-900", value: "oklch(0.18 0.018 55)" },
  { name: "warm-950", value: "oklch(0.14 0.015 50)" },
];

const TERRACOTTA_SWATCHES = [
  { name: "terracotta-300", value: "oklch(0.80 0.10 35)" },
  { name: "terracotta-400", value: "oklch(0.73 0.13 35)" },
  { name: "terracotta-500", value: "oklch(0.66 0.14 35)" },
  { name: "terracotta-600", value: "oklch(0.56 0.13 35)" },
  { name: "terracotta-700", value: "oklch(0.46 0.10 35)" },
];

const TYPE_SAMPLES = [
  { token: "font-size-xs", size: 11, weight: 400, label: "Extra small" },
  { token: "font-size-sm", size: 12, weight: 400, label: "Small" },
  { token: "font-size-base", size: 14, weight: 400, label: "Base body" },
  { token: "font-size-md", size: 16, weight: 500, label: "Medium" },
  { token: "font-size-lg", size: 20, weight: 600, label: "Large heading" },
  { token: "font-size-xl", size: 24, weight: 600, label: "Extra large" },
  { token: "font-size-2xl", size: 32, weight: 600, label: "Display" },
];

function Swatch({ name, value }: { name: string; value: string }) {
  return (
    <div className={styles["swatch"]}>
      <div className={styles["swatch-color"]} style={{ background: value }} />
      <div className={styles["swatch-label"]}>{name}</div>
    </div>
  );
}

export function DesignGallery() {
  return (
    <main className={styles["gallery"]} data-testid="design-gallery">
      <div className={styles["gallery-inner"]}>
        <h1 className={styles["gallery-title"]}>Design System — Warm Calm</h1>
        <p className={styles["gallery-subtitle"]}>
          The locked visual language. Open <code>/</code> for the app shell, this page
          for the gallery.
        </p>

        <section className={styles["section"]} data-testid="section-colors">
          <h2 className={styles["section-title"]}>Color</h2>
          <p className={styles["section-description"]}>
            Warm-tinted neutrals and a single terracotta accent. No pure black or
            white anywhere.
          </p>

          <h3 className={styles["scale-name"]}>Warm (neutrals)</h3>
          <div className={styles["swatch-grid"]}>
            {WARM_SWATCHES.map((s) => (
              <Swatch key={s.name} name={s.name} value={s.value} />
            ))}
          </div>

          <h3 className={styles["scale-name"]} style={{ marginTop: "var(--space-6)" }}>
            Terracotta (accent)
          </h3>
          <div className={styles["swatch-grid"]}>
            {TERRACOTTA_SWATCHES.map((s) => (
              <Swatch key={s.name} name={s.name} value={s.value} />
            ))}
          </div>
        </section>

        <section className={styles["section"]} data-testid="section-typography">
          <h2 className={styles["section-title"]}>Typography</h2>
          <p className={styles["section-description"]}>
            Inter for UI, JetBrains Mono for time and data. Six sizes, three weights.
          </p>
          <Card padding="md">
            {TYPE_SAMPLES.map((s) => (
              <div key={s.token} className={styles["type-sample"]}>
                <span className={styles["type-name"]}>{s.token}</span>
                <span
                  className={styles["type-render"]}
                  style={{ fontSize: `${s.size}px`, fontWeight: s.weight }}
                >
                  {s.label}
                </span>
              </div>
            ))}
          </Card>
        </section>

        <section className={styles["section"]} data-testid="section-primitives">
          <h2 className={styles["section-title"]}>Primitives</h2>
          <p className={styles["section-description"]}>
            Every UI surface in the app is built from these.
          </p>

          <div className={styles["primitives-grid"]}>
            <div className={styles["primitive-demo"]}>
              <span className={styles["primitive-label"]}>Button</span>
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
            </div>

            <div className={styles["primitive-demo"]}>
              <span className={styles["primitive-label"]}>Input</span>
              <Input placeholder="Text input…" aria-label="Demo input" />
            </div>

            <div className={styles["primitive-demo"]}>
              <span className={styles["primitive-label"]}>Textarea</span>
              <Textarea
                placeholder="Textarea…"
                aria-label="Demo textarea"
                style={{ minWidth: 280 }}
              />
            </div>

            <div className={styles["primitive-demo"]}>
              <span className={styles["primitive-label"]}>Surface</span>
              <Surface>Surface content</Surface>
            </div>

            <div className={styles["primitive-demo"]}>
              <span className={styles["primitive-label"]}>Card (elevated)</span>
              <Card padding="md" elevated>
                Elevated card
              </Card>
            </div>
          </div>
        </section>

        <section className={styles["section"]} data-testid="section-calendar-preview">
          <h2 className={styles["section-title"]}>Calendar preview</h2>
          <p className={styles["section-description"]}>
            The two block states used in the week grid. Busy (muted) and suggested
            (terracotta).
          </p>
          <div className={styles["suggested-row"]}>
            <div className={styles["busy-block"]} data-testid="busy-block" />
            <div className={styles["suggested-block"]} data-testid="suggested-block">
              Suggested · 2h
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
