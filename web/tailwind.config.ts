import type { Config } from "tailwindcss";

// Brand colours come from the active team via CSS variables (see globals.css +
// applyTeamTheme in lib/teams.ts). Neutral ink/paper tokens stay fixed so
// secondary text reads on any team background.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#f7f3ea",
        rink: "#ece6d8",
        ink: {
          DEFAULT: "#16202e",
          soft: "#5b6675",
        },
        penalty: "#a5262c",
        gold: "#c69b3f",
        team: "var(--team-primary)",
        "team-2": "var(--team-secondary)",
        "team-ink": "var(--team-text)",
      },
      fontFamily: {
        numeral: ["Georgia", "Cambria", "Times New Roman", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
