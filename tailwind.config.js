/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        newsreader: ['"Newsreader"', 'serif'],
        mono: ['"Source Code Pro"', 'monospace'],
      },
      colors: {
        charcoal: {
          DEFAULT: '#1a1a1a',
          light: '#222222',
          lighter: '#2a2a2a',
          400: '#333333',
        },
        offwhite: {
          DEFAULT: '#f5f2eb',
          dim: '#c8c4bc',
        },
        terracotta: {
          DEFAULT: '#c75b39',
          hover: '#b04d2e',
        },
      },
    },
  },
  plugins: [],
}
