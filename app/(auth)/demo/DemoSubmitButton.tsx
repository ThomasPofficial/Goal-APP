"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

export function DemoSubmitButton({
  icon,
  title,
  subtitle,
  variant = "secondary",
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  variant?: "primary" | "secondary";
}) {
  const { pending } = useFormStatus();
  const isPrimary = variant === "primary";

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full flex items-center gap-4 py-5 px-6 text-left disabled:cursor-not-allowed disabled:opacity-70"
      style={
        isPrimary
          ? { background: "var(--amber, #E8893A)", color: "#000", borderRadius: 8, fontWeight: 600, boxShadow: "0 4px 20px rgba(232,137,58,0.35)", border: "none", cursor: "pointer" }
          : { background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border-md)", borderRadius: 8, cursor: "pointer" }
      }
    >
      {pending ? (
        <Loader2
          className="w-8 h-8 flex-shrink-0 animate-spin"
          style={!isPrimary ? { color: "var(--amber, #E8893A)" } : undefined}
        />
      ) : (
        icon
      )}
      <span>
        <span className="block font-semibold text-lg">{pending ? "Signing in…" : title}</span>
        <span className="block text-sm mt-0.5" style={!isPrimary ? { color: "var(--muted)" } : { opacity: 0.75 }}>
          {subtitle}
        </span>
      </span>
    </button>
  );
}
