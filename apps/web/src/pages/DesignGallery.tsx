import { Button } from "../components/Button/index.js";
import { Card } from "../components/Card/index.js";
import { Input } from "../components/Input/index.js";
import { Textarea } from "../components/Input/index.js";
import { Surface } from "../components/Surface/index.js";
import styles from "./DesignGallery.module.css";

const CREAM_SWATCHES = [
  { name: "cream-50", value: "oklch(0.97 0.012 100)" },
  { name: "cream-100", value: "oklch(0.94 0.018 100)" },
  { name: "cream-200", value: "oklch(0.88 0.024 100)" },
  { name: "cream-300", value: "oklch(0.78 0.028 100)" },
  { name: "cream-400", value: "oklch(0.64 0.030 100)" },
  { name: "cream-500", value: "oklch(0.50 0.026 100)" },
  { name: "cream-600", value: "oklch(0.40 0.023 100)" },
  { name: "cream-700", value: "oklch(0.32 0.021 100)" },
  { name: "cream-800", value: "oklch(0.25 0.019 100)" },
  { name: "cream-850", value: "oklch(0.22 0.018 100)" },
  { name: "cream-900", value: "oklch(0.18 0.016 100)" },
  { name: "cream-950", value: "oklch(0.13 0.013 100)" },
];

const YELLOW_SWATCHES = [
  { name: "yellow-300", value: "oklch(0.86 0.10 100)" },
  { name: "yellow-400", value: "oklch(0.80 0.12 100)" },
  { name: "yellow-500", value: "oklch(0.72 0.13 100)" },
  { name: "yellow-600", value: "oklch(0.62 0.12 100)" },
  { name: "yellow-700", value: "oklch(0.52 0.10 100)" },
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
        <h1 className={styles["gallery-title"]}>Design System — Soft Butter</h1>
        <p className={styles["gallery-subtitle"]}>
          The locked visual language. Open <code>/</code> for the app shell, this page
          for the gallery.
        </p>

        <section className={styles["section"]} data-testid="section-colors">
          <h2 className={styles["section-title"]}>Color</h2>
          <p className={styles["section-description"]}>
            Cream-tinted neutrals and a single yellow accent. No pure black or
            white anywhere.
          </p>

          <h3 className={styles["scale-name"]}>Cream (neutrals)</h3>
          <div className={styles["swatch-grid"]}>
            {CREAM_SWATCHES.map((s) => (
              <Swatch key={s.name} name={s.name} value={s.value} />
            ))}
          </div>

          <h3 className={styles["scale-name"]} style={{ marginTop: "var(--space-6)" }}>
            Yellow (accent)
          </h3>
          <div className={styles["swatch-grid"]}>
            {YELLOW_SWATCHES.map((s) => (
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
            (yellow).
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
