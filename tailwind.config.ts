import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        white: "rgb(var(--color-white) / <alpha-value>)",
        black: "rgb(var(--color-black) / <alpha-value>)",
        // Design system
        navy: {
          950: "rgb(var(--color-navy-950) / <alpha-value>)",
          900: "rgb(var(--color-navy-900) / <alpha-value>)",
          800: "rgb(var(--color-navy-800) / <alpha-value>)",
          700: "rgb(var(--color-navy-700) / <alpha-value>)",
          600: "rgb(var(--color-navy-600) / <alpha-value>)",
        },
        violet: {
          DEFAULT: "#E8253A",
          light: "#FF3D52",
          dark: "#C41E31",
          glow: "#E8253A33",
        },
        gold: {
          DEFAULT: "#FF6B6B",
          light: "#FF8E8E",
          dark: "#CC4444",
        },
        emerald: {
          fin: "#10D98C",
          "fin-dim": "#10D98C22",
        },
        rose: {
          fin: "#FF5C7A",
          "fin-dim": "#FF5C7A22",
        },
        surface: {
          DEFAULT: "rgb(var(--color-surface) / <alpha-value>)",
          raised: "rgb(var(--color-surface-raised) / <alpha-value>)",
          overlay: "rgb(var(--color-surface-overlay) / <alpha-value>)",
        },
        text: {
          primary: "rgb(var(--color-text-primary) / <alpha-value>)",
          secondary: "rgb(var(--color-text-secondary) / <alpha-value>)",
          muted: "rgb(var(--color-text-muted) / <alpha-value>)",
        },
      },
      fontFamily: {
        display: ["'DM Sans'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      backgroundImage: {
        "gradient-violet": "linear-gradient(135deg, #E8253A 0%, #C41E31 100%)",
        "gradient-gold": "linear-gradient(135deg, #FF6B6B 0%, #CC4444 100%)",
        "gradient-card": "linear-gradient(145deg, rgb(var(--color-surface-raised)) 0%, rgb(var(--color-surface)) 100%)",
      },
      boxShadow: {
        "violet-glow": "0 0 40px rgba(232, 37, 58, 0.25)",
        "card": "var(--shadow-card)",
        "card-hover": "var(--shadow-card-hover)",
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out",
        "slide-up": "slideUp 0.5s ease-out",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideUp: { "0%": { opacity: "0", transform: "translateY(16px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
      },
    },
  },
  plugins: [],
};

export default config;
