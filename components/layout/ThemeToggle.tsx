"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("nivarro-theme");
    if (stored === "light") {
      setTheme("light");
      document.body.classList.add("day");
    }
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    if (next === "light") {
      document.body.classList.add("day");
      localStorage.setItem("nivarro-theme", "light");
    } else {
      document.body.classList.remove("day");
      localStorage.setItem("nivarro-theme", "dark");
    }
  }

  if (!mounted) return null;

  const Icon = theme === "dark" ? Sun : Moon;

  if (compact) {
    return (
      <button
        onClick={toggle}
        aria-label="Toggle theme"
        style={{
          width: 32, height: 32, borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "transparent",
          color: "var(--text2)",
          border: "1px solid var(--border-md)",
          cursor: "pointer",
          transition: "background 120ms, color 120ms, border-color 120ms",
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = "var(--surface2)";
          (e.currentTarget as HTMLButtonElement).style.color = "var(--text)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = "transparent";
          (e.currentTarget as HTMLButtonElement).style.color = "var(--text2)";
        }}
      >
        <Icon size={15} />
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium transition-all"
      style={{
        color: "var(--text2)",
        background: "transparent",
        border: "none",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "var(--surface2)";
        (e.currentTarget as HTMLButtonElement).style.color = "var(--text)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "transparent";
        (e.currentTarget as HTMLButtonElement).style.color = "var(--text2)";
      }}
    >
      <Icon size={15} style={{ flexShrink: 0 }} />
      <span style={{ fontFamily: "var(--font-body, sans-serif)" }}>
        {theme === "dark" ? "Light mode" : "Dark mode"}
      </span>
    </button>
  );
}
