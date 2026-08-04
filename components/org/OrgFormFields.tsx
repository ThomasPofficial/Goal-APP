import type { CSSProperties, ReactNode } from "react";

export const CATEGORIES = [
  "ACCELERATOR", "FELLOWSHIP", "INTERNSHIP", "COMPETITION", "BOOTCAMP", "RESEARCH", "CLUB",
] as const;

export type OrgCategory = (typeof CATEGORIES)[number];

export interface FieldProps { label: string; required?: boolean; hint?: string; hintOk?: boolean; children: ReactNode; }

export function Field({ label, required, hint, hintOk, children }: FieldProps) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text2)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
          {label} {required && <span style={{ color: "#f87171" }}>*</span>}
        </label>
        {hint && <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: hintOk ? "var(--amber)" : "var(--muted)" }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

export const inputStyle: CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "8px 12px",
  border: "1px solid var(--border-md)", background: "var(--bg)",
  color: "var(--text)", fontSize: 14, outline: "none", fontFamily: "inherit",
};

export const colorPickerStyle: CSSProperties = {
  width: 32, height: 32, border: "1px solid var(--border-md)",
  cursor: "pointer", padding: 2, background: "var(--bg)", flexShrink: 0,
};
