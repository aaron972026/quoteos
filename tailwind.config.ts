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
        // FencePros brand
        navy: {
          DEFAULT: "#1F3A5F",
          50: "#E6ECF3",
          100: "#C5D2E1",
          200: "#9BAEC8",
          300: "#7189AE",
          400: "#476495",
          500: "#1F3A5F",
          600: "#192F4C",
          700: "#13243A",
          800: "#0D1928",
          900: "#070D14",
        },
        accent: {
          DEFAULT: "#F4A623",
          50: "#FEF4E1",
          100: "#FDE5BB",
          200: "#FACA76",
          300: "#F7B649",
          400: "#F4A623",
          500: "#D38A0E",
          600: "#A56C0B",
          700: "#774E08",
          800: "#493005",
          900: "#1B1202",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      animation: {
        "pulse-soft": "pulse 3s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
