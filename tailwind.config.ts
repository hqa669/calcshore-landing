import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  // The ported design ships a 2,185-line stylesheet with its own reset
  // (`* { margin:0; padding:0; box-sizing:border-box }`, `html`, `body`, heading,
  // list and anchor rules). Tailwind's preflight would silently fight it, so it
  // is disabled. `@tailwind base` stays in globals.css but now emits nothing.
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      // Point Tailwind's font utilities at the next/font CSS variables from
      // app/layout.tsx so utilities and the design sheet resolve to the same
      // fonts. The design owns color, so no `colors` extension here.
      fontFamily: {
        serif: ["var(--font-playfair)", "serif"],
        sans: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
