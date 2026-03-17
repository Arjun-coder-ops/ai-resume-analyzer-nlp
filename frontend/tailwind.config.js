/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        display: ['Syne', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        ink: {
          50:  '#f0f0f5',
          100: '#e0e0eb',
          200: '#c2c2d6',
          300: '#9494ba',
          400: '#6666a0',
          500: '#3d3d7a',
          600: '#2e2e5e',
          700: '#1f1f42',
          800: '#141428',
          900: '#0a0a14',
        },
        volt: {
          50:  '#f5ffe0',
          100: '#e8ffa8',
          200: '#d4ff6b',
          300: '#c2ff3d',
          400: '#b3ff1a',
          500: '#a0f000',
          600: '#7ec200',
          700: '#5e9100',
          800: '#3e6000',
          900: '#1f3000',
        },
        rose: {
          neon: '#ff3e6c',
        }
      },
      animation: {
        'fade-up':    'fadeUp 0.5s ease forwards',
        'fade-in':    'fadeIn 0.4s ease forwards',
        'slide-in':   'slideIn 0.4s ease forwards',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'spin-slow':  'spin 3s linear infinite',
        'shimmer':    'shimmer 1.8s infinite',
        'count-up':   'countUp 1.5s ease-out forwards',
        'scale-in':   'scaleIn 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards',
      },
      keyframes: {
        fadeUp:   { from: { opacity: 0, transform: 'translateY(20px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        fadeIn:   { from: { opacity: 0 }, to: { opacity: 1 } },
        slideIn:  { from: { opacity: 0, transform: 'translateX(-20px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
        shimmer:  { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        scaleIn:  { from: { opacity: 0, transform: 'scale(0.8)' }, to: { opacity: 1, transform: 'scale(1)' } },
      },
      backdropBlur: { xs: '2px' },
      boxShadow: {
        'volt':    '0 0 30px rgba(160,240,0,0.25), 0 0 60px rgba(160,240,0,0.1)',
        'volt-sm': '0 0 15px rgba(160,240,0,0.2)',
        'glass':   '0 8px 32px rgba(0,0,0,0.4)',
        'card':    '0 2px 16px rgba(0,0,0,0.5)',
      },
    },
  },
  plugins: [],
}
