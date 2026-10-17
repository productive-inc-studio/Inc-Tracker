/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '"IBM Plex Sans Thai"', 'system-ui', 'sans-serif'],
      },
      colors: {
        bg: token('bg'),
        surface: token('surface'),
        sunken: token('sunken'),
        line: token('line'),
        ink: token('ink'),
        muted: token('muted'),
        brand: token('brand'),
        'brand-ink': token('brand-ink'),
        pop: token('pop'),
        danger: token('danger'),
        warn: token('warn'),
        ok: token('ok'),
        info: token('info'),
      },
      borderRadius: { xl: '14px', '2xl': '18px', '3xl': '24px' },
      boxShadow: {
        card: '0 1px 2px rgb(var(--shadow) / 0.06), 0 1px 1px rgb(var(--shadow) / 0.04)',
        pop: '0 12px 32px -8px rgb(var(--shadow) / 0.25), 0 2px 6px rgb(var(--shadow) / 0.08)',
      },
      keyframes: {
        'slide-in': { from: { transform: 'translateX(24px)', opacity: 0 }, to: { transform: 'none', opacity: 1 } },
        'slide-up': { from: { transform: 'translateY(24px)', opacity: 0 }, to: { transform: 'none', opacity: 1 } },
        'fade-in': { from: { opacity: 0 }, to: { opacity: 1 } },
      },
      animation: {
        'slide-in': 'slide-in .22s cubic-bezier(.2,.8,.2,1)',
        'slide-up': 'slide-up .25s cubic-bezier(.2,.8,.2,1)',
        'fade-in': 'fade-in .15s ease-out',
      },
    },
  },
  plugins: [],
}
