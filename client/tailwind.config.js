/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        blackbox: {
          bg: '#0B0E12',
          surface: '#11161C',
          panel: '#171D25',
          elevated: '#1C2430',
          border: '#293340',
          borderLight: '#3A4654',
          muted: '#738091',
          text: '#EDF2F7',
          textSecondary: '#AAB6C4',
          cyan: '#62D8E8',
          cyanMuted: '#338D9D',
          success: '#53C59A',
          warning: '#E7B766',
          critical: '#E4777D',
          info: '#86AEE8',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'JetBrains Mono', 'Fira Code', 'Menlo', 'monospace'],
      },
      boxShadow: {
        'blackbox-panel': '0 12px 36px rgba(0, 0, 0, 0.18)',
        'blackbox-focus': '0 0 0 3px rgba(98, 216, 232, 0.18)',
      },
      borderRadius: {
        'blackbox': '14px',
      },
    },
  },
  plugins: [],
};
