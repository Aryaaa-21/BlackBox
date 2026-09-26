/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        blackbox: {
          bg: '#0A0C0F',
          surface: '#13161B',
          panel: '#1A1E26',
          border: '#242933',
          borderLight: '#323946',
          muted: '#6B7280',
          text: '#F3F4F6',
          textSecondary: '#9CA3AF',
          cyan: '#00D2FF',
          cyanMuted: '#007A99',
          success: '#10B981',
          warning: '#F59E0B',
          critical: '#EF4444',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
