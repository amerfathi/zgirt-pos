/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        zgirt: {
          50: '#f8fafc',
          100: '#f1f5f9',
          500: '#334155',
          800: '#0f172a',
          900: '#020617',
          gold: '#d97706'
        }
      }
    },
  },
  plugins: [],
}
