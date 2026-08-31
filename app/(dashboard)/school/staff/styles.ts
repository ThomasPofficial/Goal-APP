import type { CSSProperties } from "react";

export const inputStyle: CSSProperties = {
  padding: "8px 12px",
  border: "1px solid var(--border)",
  background: "var(--bg)",
  color: "var(--text)",
  fontSize: 13,
  borderRadius: 0,
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
};

export const labelStyle: CSSProperties = {
  display: "block",
  fontSize: 11,
  fontFamily: "var(--font-mono)",
  letterSpacing: "0.08em",
  color: "var(--muted)",
  marginBottom: 6,
  textTransform: "uppercase",
};

export const sectionHeadingStyle: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: 18,
  fontWeight: 700,
  color: "var(--text)",
  margin: "0 0 14px",
};

export const sectionCardStyle: CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 0,
  padding: "20px 22px",
  marginBottom: 24,
};

export const primaryButtonStyle: CSSProperties = {
  padding: "8px 20px",
  background: "var(--amber)",
  border: "1px solid var(--amber)",
  color: "#000",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  cursor: "pointer",
  borderRadius: 0,
  whiteSpace: "nowrap",
};

export const selectStyle: CSSProperties = {
  padding: "6px 10px",
  border: "1px solid var(--border)",
  background: "var(--bg)",
  color: "var(--text)",
  fontSize: 12,
  fontFamily: "var(--font-mono)",
  borderRadius: 0,
  outline: "none",
};

export function capabilityLabel(cap: string): string {
  return cap.replace(":", " · ");
}
