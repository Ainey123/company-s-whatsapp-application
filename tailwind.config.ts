import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#E8F5E9",
          100: "#C8E6C9",
          200: "#A5D6A7",
          300: "#81C784",
          400: "#4CAF50",
          500: "#10B981",
          600: "#00A884",
          700: "#075E54",
          800: "#0F5132",
          900: "#064E3B",
          dark: "#005C4B",
        },
        chat: {
          lightBg: "#EFEAE2",
          lightPanel: "#FFFFFF",
          lightOut: "#D9FDD3",
          lightIn: "#FFFFFF",
          lightBorder: "#E9EDEF",
          lightText: "#111B21",
          lightSubtext: "#667781",
          darkBg: "#0C1317",
          darkPanel: "#111B21",
          darkSidebar: "#111B21",
          darkOut: "#005C4B",
          darkIn: "#202C33",
          darkBorder: "#222D34",
          darkText: "#E9EDEF",
          darkSubtext: "#8696A0",
        }
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
