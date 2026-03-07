import type { Config } from "tailwindcss";

export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark scholarly backgrounds
        base: "#0F0F11",
        surface: "#16161A",
        elevated: "#1E1E24",
        border: "#2A2A33",
        "border-subtle": "#222228",

        // Text hierarchy
        text: {
          primary: "#E8E8EC",
          secondary: "#9898A8",
          muted: "#5A5A6A",
          inverse: "#0F0F11",
        },

        // Amber accent (library lamp warmth)
        amber: {
          DEFAULT: "#C9A84C",
          light: "#E3C06A",
          dark: "#9E7D30",
          subtle: "rgba(201,168,76,0.10)",
        },

        // Trait category colors
        trait: {
          vision: "#7B61FF",
          execution: "#FF6B35",
          communication: "#4ECDC4",
          collaboration: "#45B7D1",
          organization: "#A8E063",
          analytical: "#F7DC6F",
          adaptability: "#BB8FCE",
          integrity: "#F1948A",
        },

        // Semantic
        success: "#4ADE80",
        warning: "#FBBF24",
        error: "#F87171",
        info: "#60A5FA",
      },

      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        serif: ["var(--font-playfair)", "Georgia", "serif"],
        mono: ["JetBrains Mono", "Menlo", "monospace"],
      },

      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
      },

      borderRadius: {
        card: "10px",
      },

      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.24)",
        "card-hover":
          "0 8px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(201,168,76,0.15)",
        "amber-glow": "0 0 20px rgba(201,168,76,0.12)",
        modal: "0 24px 48px rgba(0,0,0,0.6)",
      },

      animation: {
        "fade-in": "fadeIn 0.2s ease",
        "slide-up": "slideUp 0.2s ease",
      },

      keyframes: {
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
