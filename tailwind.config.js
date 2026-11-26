/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cyan: { hud: '#00D9FF' },
        teal: { hud: '#00FFF0' },
        void: '#05090F',
        panel: '#0A1520',
        ice: '#EAFBFF',
        warn: '#FF9D36',
        crit: '#FF334F',
      },
      fontFamily: {
        display: ['"Rajdhani"', '"Orbitron"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Share Tech Mono"', 'ui-monospace', 'monospace'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(0,217,255,.25), 0 0 24px -6px rgba(0,217,255,.45)',
        'glow-sm': '0 0 12px -4px rgba(0,217,255,.6)',
      },
    },
  },
  plugins: [],
};
