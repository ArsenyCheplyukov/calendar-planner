import { useEffect, useState } from "react";
import { Button } from "../components/Button/index.js";
import { Card } from "../components/Card/index.js";
import { Input } from "../components/Input/index.js";
import styles from "./Settings.module.css";

export type SettingsPrefs = {
  workingHoursStart: string;
  workingHoursEnd: string;
  bufferMinutes: number;
  typeBiasFocus: string;
  typeBiasMeeting: string;
  typeBiasPersonal: string;
  typeBiasErrand: string;
  blackouts: Array<{ dayOfWeek: string; start: string; end: string }>;
};

const DEFAULTS: SettingsPrefs = {
  workingHoursStart: "09:00",
  workingHoursEnd: "19:00",
  bufferMinutes: 15,
  typeBiasFocus: "09:00-12:00",
  typeBiasMeeting: "11:00-16:00",
  typeBiasPersonal: "any",
  typeBiasErrand: "16:00-19:00",
  blackouts: [],
};

type Status =
  | { kind: "loading" }
  | { kind: "ready"; prefs: SettingsPrefs }
  | { kind: "error"; message: string };

export function Settings() {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [draft, setDraft] = useState<SettingsPrefs | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    fetch("/api/preferences")
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as SettingsPrefs;
        setStatus({ kind: "ready", prefs: data });
        setDraft(data);
      })
      .catch((e) =>
        setStatus({
          kind: "error",
          message: e instanceof Error ? e.message : String(e),
        }),
      );
  }, []);

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as SettingsPrefs;
      setStatus({ kind: "ready", prefs: data });
      setDraft(data);
      setFeedback({ tone: "success", message: "Сохранено" });
    } catch (e) {
      setFeedback({ tone: "error", message: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  };

  if (status.kind === "loading") {
    return <div className={styles["subtitle"]}>Загрузка…</div>;
  }
  if (status.kind === "error") {
    return <div className={styles["subtitle"]}>Ошибка: {status.message}</div>;
  }
  if (!draft) return null;

  return (
    <div className={styles["settings"]} data-testid="settings-page">
      <div className={styles["header"]}>
        <h1 className={styles["title"]}>Settings</h1>
        <p className={styles["subtitle"]}>
          Working hours, buffer, and type biases. Changes apply to the next plan
          you create.
        </p>
      </div>

      <Card padding="md">
        <div className={styles["section"]}>
          <h2 className={styles["sectionTitle"]}>Working hours</h2>
          <div className={styles["row"]}>
            <div className={styles["field"]}>
              <label className={styles["label"]} htmlFor="workingHoursStart">
                Начало рабочего дня
              </label>
              <Input
                id="workingHoursStart"
                type="time"
                value={draft.workingHoursStart}
                onChange={(e) =>
                  setDraft({ ...draft, workingHoursStart: e.target.value })
                }
              />
            </div>
            <div className={styles["field"]}>
              <label className={styles["label"]} htmlFor="workingHoursEnd">
                Конец рабочего дня
              </label>
              <Input
                id="workingHoursEnd"
                type="time"
                value={draft.workingHoursEnd}
                onChange={(e) =>
                  setDraft({ ...draft, workingHoursEnd: e.target.value })
                }
              />
            </div>
          </div>
        </div>
      </Card>

      <Card padding="md">
        <div className={styles["section"]}>
          <h2 className={styles["sectionTitle"]}>Buffer between events</h2>
          <div className={styles["field"]}>
            <label className={styles["label"]} htmlFor="bufferMinutes">
              Минут между событиями
            </label>
            <Input
              id="bufferMinutes"
              type="number"
              min={0}
              max={120}
              value={String(draft.bufferMinutes)}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n) && n >= 0) {
                  setDraft({ ...draft, bufferMinutes: n });
                }
              }}
            />
          </div>
        </div>
      </Card>

      <Card padding="md">
        <div className={styles["section"]}>
          <h2 className={styles["sectionTitle"]}>Type biases</h2>
          <p className={styles["subtitle"]}>
            Preferred time windows per event type. Format "HH:MM-HH:MM" or
            "any".
          </p>
          <div className={styles["row"]}>
            <div className={styles["field"]}>
              <label className={styles["label"]} htmlFor="typeBiasFocus">
                Focus
              </label>
              <Input
                id="typeBiasFocus"
                value={draft.typeBiasFocus}
                onChange={(e) =>
                  setDraft({ ...draft, typeBiasFocus: e.target.value })
                }
              />
            </div>
            <div className={styles["field"]}>
              <label className={styles["label"]} htmlFor="typeBiasMeeting">
                Meeting
              </label>
              <Input
                id="typeBiasMeeting"
                value={draft.typeBiasMeeting}
                onChange={(e) =>
                  setDraft({ ...draft, typeBiasMeeting: e.target.value })
                }
              />
            </div>
            <div className={styles["field"]}>
              <label className={styles["label"]} htmlFor="typeBiasPersonal">
                Personal
              </label>
              <Input
                id="typeBiasPersonal"
                value={draft.typeBiasPersonal}
                onChange={(e) =>
                  setDraft({ ...draft, typeBiasPersonal: e.target.value })
                }
              />
            </div>
            <div className={styles["field"]}>
              <label className={styles["label"]} htmlFor="typeBiasErrand">
                Errand
              </label>
              <Input
                id="typeBiasErrand"
                value={draft.typeBiasErrand}
                onChange={(e) =>
                  setDraft({ ...draft, typeBiasErrand: e.target.value })
                }
              />
            </div>
          </div>
        </div>
      </Card>

      <div className={styles["actions"]}>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Сохраняю…" : "Сохранить"}
        </Button>
        {feedback && (
          <div
            className={`${styles["toast"]} ${
              feedback.tone === "success" ? styles["toastSuccess"] : styles["toastError"]
            }`}
            data-testid={feedback.tone === "success" ? "settings-toast" : "settings-error"}
            role="status"
          >
            {feedback.message}
          </div>
        )}
      </div>
    </div>
  );
}

// Default export to satisfy ts unused warnings
export { DEFAULTS };
