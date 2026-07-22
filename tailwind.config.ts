// Ivory Fence Co. QuoteOS — brand tokens v2.0 (Ivory rebrand)
// Forest green = primary action (CTAs, links, active states). Gold = TRIM
// ONLY (rules, quote numbers, grand total, logo dot) — never more than ~5%
// of a screen. Noir = dark brand surfaces (heroes, quote header, footer).
//
// NOTE ON NAMES: the legacy role names (navy/brick/brass/cream/paper) are
// retained and re-pointed at the Ivory palette so the ~1000 existing class
// usages keep working. Read them by ROLE, not by hue:
//   navy  = dark brand surface (now Noir)
//   brick = primary action     (now Forest green)
//   brass = trim accent        (now Gold)
//   cream/paper = warm surface (now Ivory)
// The spec's semantic names are also defined below — prefer those in new code.

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

        // ── Legacy role names, re-pointed to the Ivory palette ──────────
        // Dark brand surface (was Anchor Navy → now Noir)
        navy: "#16120D",
        "navy-deep": "#0F0C08",
        "navy-soft": "#211C15",

        // Primary action (was Storm Brick → now Forest green)
        brick: "#2F5D43",
        "brick-deep": "#234636",
        accent: "#2F5D43",

        // Trim only (was Picket Brass → now Gold)
        brass: "#C99A3F",
        "brass-soft": "#E9C87E",

        // Warm surfaces (was Tulsa Cream → now Ivory)
        cream: "#F7F0E1",
        "cream-deep": "#EFE4CC",
        paper: "#FCF9F1",

        // Warm neutrals (cool grays → warm inks)
        ink: { DEFAULT: "#23201A", 400: "#8A8172", 600: "#5C554A", 900: "#23201A" },
        char: "#5C554A",
        steel: "#8A8172",
        "steel-soft": "#A79E8E",

        // ── Ivory palette, semantic names (prefer these in new code) ────
        ivory: { 50: "#FCF9F1", 100: "#F7F0E1", 200: "#EFE4CC", 300: "#E2D3B3" },
        noir: { 700: "#2E2820", 800: "#211C15", 900: "#16120D" },
        gold: { 300: "#E9C87E", 500: "#C99A3F", 600: "#A87E2B", 700: "#8A6722" },
        forest: {
          50: "#EDF3EC",
          300: "#7FA88C",
          600: "#2F5D43",
          700: "#234636",
          800: "#1B3628",
        },
        brand: { DEFAULT: "#2F5D43", hover: "#234636" },

        // Functional
        success: "#2F5D43",
        "success-tint": "#EDF3EC",
        warning: "#B0761F",
        "warning-tint": "#F7EBD4",
        error: "#9E3B2E",
        "error-tint": "#F6E4E0",
        info: "#5B7386",
        "info-tint": "#E8EDF1",
      },
      fontFamily: {
        // next/font/google injects CSS variables; defaults fall back to
        // system fonts so dev keeps working even before fonts load.
        display: ["var(--font-display)", "Fraunces", "Georgia", "serif"],
        body: ["var(--font-body)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "ui-monospace", "monospace"],
        sans: ["var(--font-body)", "Inter", "system-ui", "sans-serif"],
      },
      fontSize: {
        // Fraunces is a serif — headline tracking tightens per spec
        // (-0.01em) where Oswald's condensed forms wanted it open.
        "d-h1": ["84px", { lineHeight: "0.98", letterSpacing: "-0.01em" }],
        "d-h2": ["56px", { lineHeight: "1.05", letterSpacing: "-0.005em" }],
        "d-h3": ["28px", { lineHeight: "1.15", letterSpacing: "0.04em" }],
        "d-h4": ["18px", { lineHeight: "1.25", letterSpacing: "0.12em" }],
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
        // Ivory softens the old 2-4px hard edges. Cards read at `rounded-sm`
        // across the app, so `sm` carries the card radius.
        DEFAULT: "8px",
        sm: "8px",
        md: "10px",
        lg: "12px",
        pill: "999px",
      },
      boxShadow: {
        // Warm shadows (were blue-tinted rgba(18,28,51,…)).
        card: "0 8px 24px rgba(22,18,13,.10), 0 1px 2px rgba(22,18,13,.06)",
        "card-lg": "0 24px 60px -30px rgba(22,18,13,.35)",
        cta: "0 1px 0 rgba(0,0,0,.08), 0 8px 24px -12px rgba(35,70,54,.45)",
        modal: "0 30px 80px rgba(22,18,13,.35)",
        map: "0 30px 80px -30px rgba(22,18,13,.6)",
      },
      backgroundImage: {
        // Spec §4.4 — the one "premium" button treatment.
        champagne: "linear-gradient(135deg, #E9C87E 0%, #C99A3F 100%)",
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
