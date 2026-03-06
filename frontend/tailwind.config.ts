import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'acars-bg':         'rgb(var(--bg-app-rgb) / <alpha-value>)',
        'acars-panel':      'rgb(var(--bg-panel-rgb) / <alpha-value>)',
        'acars-input':      'rgb(var(--bg-input-rgb) / <alpha-value>)',
        'acars-hover':      'rgb(var(--bg-hover-rgb) / <alpha-value>)',
        'acars-border':     'rgba(255, 255, 255, 0.06)',
        'acars-blue':       'rgb(var(--accent-rgb) / <alpha-value>)',
        'acars-amber':      'rgb(var(--status-amber-rgb) / <alpha-value>)',
        'acars-green':      'rgb(var(--status-green-rgb) / <alpha-value>)',
        'acars-red':        'rgb(var(--status-red-rgb) / <alpha-value>)',
        'acars-warn':       'rgb(var(--status-burn-rgb) / <alpha-value>)',
        'acars-magenta':    'rgb(var(--purple-rgb) / <alpha-value>)',
        'acars-cyan':       'rgb(var(--accent-rgb) / <alpha-value>)',
        'acars-text':       'rgb(var(--text-primary-rgb) / <alpha-value>)',
        'acars-muted':      'rgb(var(--text-secondary-rgb) / <alpha-value>)',
        'acars-badge-bg':   'var(--accent-dark)',
        'acars-badge-text': 'var(--accent)',
        // shadcn/ui semantic colors
        border:      'hsl(var(--border))',
        input:       'hsl(var(--input))',
        ring:        'hsl(var(--ring))',
        background:  'hsl(var(--background))',
        foreground:  'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      fontFamily: {
        sans: ['Lufga', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
