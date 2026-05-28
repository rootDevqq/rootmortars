/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        army: {
          50:  '#f0f4e8',
          100: '#dde8cc',
          200: '#bfd49f',
          300: '#9cbc6c',
          400: '#7ea444',
          500: '#5e8a2a',
          600: '#4a6e1f',
          700: '#3a5518',
          800: '#2c4012',
          900: '#1e2c0c',
        },
        surface: {
          900: '#0a0e14',
          800: '#111720',
          700: '#171f2d',
          600: '#1e2a3a',
          500: '#263448',
          400: '#2f3f58',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
