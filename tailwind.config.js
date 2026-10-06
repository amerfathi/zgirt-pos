/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        },
        navy: {
          50: '#f0f3fa',
          100: '#e1e7f5',
          200: '#c3cfeb',
          700: '#2c3360',
          800: '#23294e',
          850: '#1C2041', // Wafeq primary dark navy
          900: '#161933',
          950: '#0e1022',
        },
        primary: {
          50: '#f5f6ff',
          100: '#ebedfe',
          200: '#d6dcfe',
          300: '#b3bffd',
          400: '#8094fb',
          500: '#505edd', // Wafeq primary royal indigo
          600: '#434fcc',
          700: '#353ea7',
          800: '#2d3486',
          900: '#282d6e',
        },
        slate: {
          850: '#151f32',
          950: '#090d16',
        }
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          '"SF Pro Display"',
          '"SF Arabic"',
          '"SF Pro"',
          '"IBM Plex Sans Arabic"',
          '"Readex Pro"',
          'system-ui',
          'sans-serif'
        ],
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
        'premium': '0 10px 30px -5px rgba(28, 32, 65, 0.08)',
        'floating': '0 12px 36px -4px rgba(80, 94, 221, 0.25)',
      }
    },
  },
  plugins: [],
}
