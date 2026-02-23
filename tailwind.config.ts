import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        holo: {
          bg:            "#0a0a0a",
          surface:       "#111111",
          raised:        "#1a1a1a",
          border:        "#252525",
          text1:         "#f0f0f0",
          text2:         "#888888",
          text3:         "#505050",
          accent:        "#0057ff",
          "accent-hover":"#1a6aff",
        },
      },
      boxShadow: {
        "glow-accent": "0 0 20px rgba(0,87,255,0.35), 0 0 60px rgba(0,87,255,0.1)",
      },
    }
  },
  plugins: []
};

export default config;
