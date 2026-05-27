// FencePros QuoteOS — brand tokens v1.0
// Palette sourced from _design/design_handoff_quoteos_funnel/tokens/tailwind.config.ts.
// Brick = emphasis only (CTAs, price, errors). Brass = trim only (rules,
// borders, picket motifs). Never fill a large block with either.

import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",

        // Anchor Navy — primary brand surface
        navy: "#1A2A4A",
        "navy-deep": "#121C33",
        "navy-soft": "#2A3A5C",

        // Storm Brick — EMPHASIS ONLY (CTAs, price numerals, "PROS")
        brick: "#8B2332",
        "brick-deep": "#6E1A26",
        // Legacy alias: the previous palette used "accent" for the emphasis
        // role. Brick now plays that role. Aliased here so callsites that
        // still say `text-accent` keep working visually while we migrate.
        accent: "#8B2332",

        // Picket Brass — TRIM ONLY (rules, dashes, borders, pickets)
        brass: "#C8962E",
        "brass-soft": "#E0B452",

        // Tulsa Cream — paper surface
        cream: "#F4F1E8",
        "cream-deep": "#E9E4D3",
        paper: "#FBF8F0",

        // Neutrals
        ink: "#15161A",
        char: "#2C2F36",
        steel: "#6B6F76",
        "steel-soft": "#A7ABB2",
      },
      fontFamily: {
        // next/font/google injects CSS variables; defaults fall back to
        // system fonts so dev keeps working even before fonts load.
        display: ["var(--font-display)", "Oswald", "Arial Narrow", "sans-serif"],
        body: ["var(--font-body)", "Source Sans 3", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "ui-monospace", "monospace"],
        sans: ["var(--font-body)", "Source Sans 3", "system-ui", "sans-serif"],
      },
      fontSize: {
        "d-h1": ["84px", { lineHeight: "0.95", letterSpacing: "-0.01em" }],
        "d-h2": ["56px", { lineHeight: "1.0", letterSpacing: "0.02em" }],
        "d-h3": ["28px", { lineHeight: "1.1", letterSpacing: "0.06em" }],
        "d-h4": ["18px", { lineHeight: "1.2", letterSpacing: "0.12em" }],
        lead: ["21px", { lineHeight: "1.5" }],
        body: ["16px", { lineHeight: "1.55" }],
        small: ["13px", { lineHeight: "1.5" }],
      },
      letterSpacing: {
        tightest: "-0.015em",
        eyebrow: "0.12em",
        spec: "0.18em",
      },
      borderRadius: {
        DEFAULT: "2px",
        sm: "2px",
        md: "3px",
        lg: "4px",
        pill: "999px",
      },
      boxShadow: {
        card:
          "0 1px 0 rgba(0,0,0,.04), 0 12px 30px -18px rgba(18,28,51,.4)",
        "card-lg": "0 24px 60px -30px rgba(18,28,51,.35)",
        cta:
          "0 1px 0 rgba(0,0,0,.08), 0 8px 24px -12px rgba(110,26,38,.55)",
        modal: "0 30px 80px rgba(18,28,51,.35)",
        map: "0 30px 80px -30px rgba(0,0,0,.6)",
      },
      animation: {
        "pulse-soft": "pulse 3s ease-in-out infinite",
        coinpulse: "coinpulse 1.6s ease-in-out infinite",
      },
      keyframes: {
        coinpulse: {
          "0%, 100%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(1.06)", opacity: "0.8" },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
