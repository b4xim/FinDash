import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Design system — charcoal dark grey + modern crimson red
        navy: {
          950: "#0A0A0A",
          900: "#111111",
          800: "#1A1A1A",
          700: "#222222",
          600: "#2A2A2A",
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
          DEFAULT: "#1A1A1A",
          raised: "#222222",
          overlay: "#2A2A2A",
        },
        text: {
          primary: "#F5F5F5",
          secondary: "#A0A0A0",
          muted: "#555555",
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
        "gradient-card": "linear-gradient(145deg, #222222 0%, #1A1A1A 100%)",
      },
      boxShadow: {
        "violet-glow": "0 0 40px rgba(232, 37, 58, 0.25)",
        "card": "0 4px 24px rgba(0,0,0,0.5)",
        "card-hover": "0 8px 40px rgba(0,0,0,0.65)",
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
