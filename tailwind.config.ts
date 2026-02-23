import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        lagoon: "#10b4b6",
        sunset: "#f97a2d",
        palm: "#2f7a4b",
        deepsea: "#0d3b66",
        sand: "#f8f1df"
      },
      boxShadow: {
        resort: "0 10px 30px rgba(13, 59, 102, 0.18)"
      },
      borderRadius: {
        resort: "1.25rem"
      }
    }
  },
  plugins: []
};

export default config;
