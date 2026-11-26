import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef7fb",
          100: "#d0eaf5",
          200: "#a8d4ea",
          300: "#7fbfe1",
          400: "#57a9d8",
          500: "#2f94d0",
          600: "#0057a8",
          700: "#004582",
          800: "#003366",
          900: "#001f4a",
        },
        accent: {
          500: "#ff6800",
          600: "#e55a00",
        },
      },
    },
  },
  plugins: [],
};
export default config;