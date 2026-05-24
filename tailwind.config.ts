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
        primary: "#84D4FA",
        "primary-dark": "#4DB8F5",
        "primary-light": "#EAF7FF",
        secondary: "#FF7070",
        accent: "#FE4040",
        "white-smoker": "#F5F5F5",
        "gray-soft": "#F8FAFC",
      },
      fontFamily: {
        sans: ["Sarabun", "Bai Jamjuree", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      animation: {
        "fade-in": "fadeIn 0.7s ease",
        "slide-up": "slideUp 0.7s ease",
        "ripple": "rippleAnim 0.6s ease-out",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideUp: {
          from: { transform: "translateY(40px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        rippleAnim: {
          to: { transform: "scale(2)", opacity: "0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
