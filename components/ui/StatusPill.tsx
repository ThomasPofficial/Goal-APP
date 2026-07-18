interface StatusPillProps {
  label: string;
  /** Whether the pulsing accent dot is on (Active) or dim/static (Standby, Draft…) */
  active?: boolean;
  className?: string;
}

export default function StatusPill({ label, active = true, className = "" }: StatusPillProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span
        className={active ? "live-dot" : ""}
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: active ? "var(--accent)" : "var(--border-md)",
          boxShadow: active ? "0 0 8px rgba(74,128,240,0.6)" : "none",
          flexShrink: 0,
        }}
      />
      <span className="status-pill" style={{ color: active ? "var(--accent)" : "var(--muted)" }}>
        {label}
      </span>
    </span>
  );
}
