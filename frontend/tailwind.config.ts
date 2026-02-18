import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'acars-bg': '#0d1117',
        'acars-panel': '#161b22',
        'acars-border': '#30363d',
        'acars-blue': '#58a6ff',
        'acars-amber': '#f0883e',
        'acars-green': '#3fb950',
        'acars-red': '#f85149',
        'acars-magenta': '#d2a8ff',
        'acars-cyan': '#79c0ff',
        'acars-text': '#e6edf3',
        'acars-muted': '#8b949e',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
