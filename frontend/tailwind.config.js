/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        base: {
          950: '#0A0A0A',
          900: '#121212',
          800: '#1A1A1A',
          700: '#242424',
          600: '#333333',
        },
        accent: {
          DEFAULT: '#FF5C00',
          hover: '#FF7A26',
          muted: '#7A2E00',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 24px rgba(255, 92, 0, 0.25)',
        'glow-sm': '0 0 12px rgba(255, 92, 0, 0.35)',
      },
      backgroundImage: {
        grid: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
      },
      backgroundSize: {
        grid: '32px 32px',
      },
    },
  },
  plugins: [],
};
