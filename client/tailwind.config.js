/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        blackbox: {
          bg: '#050506',
          surface: '#0B0A0A',
          panel: '#14100F',
          elevated: '#1D1512',
          border: '#2D2420',
          borderLight: '#5C331F',
          muted: '#9C938D',
          text: '#F5F1ED',
          textSecondary: '#C8BFB8',
          cyan: '#002FA7',
          cobalt: '#002FA7',
          cyanMuted: '#12255E',
          success: '#002FA7',
          warning: '#8A5938',
          critical: '#5C331F',
          info: '#214BC0',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Geist', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        display: ['Space Grotesk', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'blackbox-panel': '0 12px 36px rgba(0, 0, 0, 0.34)',
        'blackbox-focus': '0 0 0 3px rgba(0, 47, 167, 0.32)',
      },
      borderRadius: {
        'blackbox': '14px',
      },
    },
  },
  plugins: [],
};
