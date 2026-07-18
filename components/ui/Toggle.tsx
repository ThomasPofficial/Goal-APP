interface ToggleProps {
  checked?: boolean;
  onChange?: (next: boolean) => void;
  /** Row label, e.g. "Motion blur" */
  label?: string;
  /** Optional helper line under the label */
  description?: string;
}

export default function Toggle({ checked = false, onChange, label, description }: ToggleProps) {
  return (
    <div
      className="flex items-center justify-between gap-6 py-4"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <div>
        {label && (
          <div className="text-sm font-bold" style={{ fontFamily: "var(--font-body)", color: "var(--text)" }}>
            {label}
          </div>
        )}
        {description && (
          <div className="text-xs mt-0.5" style={{ color: "var(--text2)" }}>
            {description}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2.5 flex-shrink-0">
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={label}
          onClick={() => onChange?.(!checked)}
          style={{
            width: 36,
            height: 18,
            flexShrink: 0,
            position: "relative",
            background: checked ? "var(--accent)" : "var(--surface3)",
            border: `1px solid ${checked ? "var(--accent)" : "var(--border-md)"}`,
            borderRadius: "var(--radius-sm)",
            cursor: "pointer",
            transition: "background 80ms, border-color 80ms",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 2,
              left: checked ? 20 : 2,
              width: 12,
              height: 12,
              background: checked ? "var(--on-accent)" : "var(--muted)",
              borderRadius: 1,
              transition: "left 80ms",
            }}
          />
        </button>
        <span
          className="w-6"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "var(--tracking-hud)",
            textTransform: "uppercase",
            color: checked ? "var(--accent)" : "var(--muted)",
          }}
        >
          {checked ? "On" : "Off"}
        </span>
      </div>
    </div>
  );
}
