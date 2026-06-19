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
        // Design system — deep navy + electric violet + warm gold
        navy: {
          950: "#070B18",
          900: "#0D1220",
          800: "#131929",
          700: "#1C2539",
          600: "#243049",
        },
        violet: {
          DEFAULT: "#7C5CFC",
          light: "#9B80FD",
          dark: "#5B3EE0",
          glow: "#7C5CFC33",
        },
        gold: {
          DEFAULT: "#F5A623",
          light: "#FBBF47",
          dark: "#D4881A",
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
          DEFAULT: "#131929",
          raised: "#1C2539",
          overlay: "#243049",
        },
        text: {
          primary: "#F0F4FF",
          secondary: "#8A94B2",
          muted: "#4A5270",
        },
      },
      fontFamily: {
        display: ["'DM Sans'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      backgroundImage: {
        "gradient-violet": "linear-gradient(135deg, #7C5CFC 0%, #5B3EE0 100%)",
        "gradient-gold": "linear-gradient(135deg, #F5A623 0%, #D4881A 100%)",
        "gradient-card": "linear-gradient(145deg, #1C2539 0%, #131929 100%)",
      },
      boxShadow: {
        "violet-glow": "0 0 40px rgba(124, 92, 252, 0.25)",
        "card": "0 4px 24px rgba(0,0,0,0.4)",
        "card-hover": "0 8px 40px rgba(0,0,0,0.5)",
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
