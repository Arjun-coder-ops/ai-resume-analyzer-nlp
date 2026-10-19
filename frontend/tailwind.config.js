/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', '-apple-system', 'BlinkMacSystemFont', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'],
        display: ['Geist', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'SF Mono', 'Menlo', 'Consolas', 'monospace'],
      },
      colors: {
        // Interior Design System Semantic Tokens
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        success: {
          DEFAULT: 'var(--success)',
          foreground: 'var(--success-foreground)',
        },
        warning: {
          DEFAULT: 'var(--warning)',
          foreground: 'var(--warning-foreground)',
        },
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        chart: {
          1: 'var(--chart-1)',
          2: 'var(--chart-2)',
          3: 'var(--chart-3)',
          4: 'var(--chart-4)',
          5: 'var(--chart-5)',
        },
        // Legacy palette mappings updated to harmonious warm interior tones
        ink: {
          50:  '#faf9f7',
          100: '#f4f3f0',
          200: '#e7e5e1',
          300: '#a8a29e',
          400: '#78716c',
          500: '#57534e',
          600: '#44403c',
          700: '#292524',
          800: '#1c1917',
          900: '#141211',
        },
        volt: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#2563eb', // Restrained cobalt accent replacing toxic neon
          500: '#1d4ed8',
          600: '#1e40af',
          700: '#1d4ed8',
          800: '#1e3a8a',
          900: '#172554',
        },
      },
      borderRadius: {
        'card': '0.875rem',    // 14px - Interior lifted card
        'input': '0.625rem',   // 10px - Interior field & well
        'btn': '0.5625rem',    // 9px  - Interior button
        'badge': '0.375rem',   // 6px  - Interior chip
        'cell': '0.3125rem',   // 5px  - Interior table cell
      },
      boxShadow: {
        'lift': '0 0.0625rem 0.125rem oklch(0.2161 0.0061 56.04 / 0.06), 0 0.25rem 0.625rem -0.5rem oklch(0.2161 0.0061 56.04 / 0.45)',
        'well': 'inset 0 0.0625rem 0.125rem oklch(0.2161 0.0061 56.04 / 0.07)',
        'cap': '0 0.0938rem 0 oklch(0.2161 0.0061 56.04 / 0.09), inset 0 0 0 0.0625rem oklch(0.2161 0.0061 56.04 / 0.11)',
        'row': 'inset 0 0 0 0.0625rem oklch(0.2161 0.0061 56.04 / 0.07), 0 0.0625rem 0.125rem oklch(0.2161 0.0061 56.04 / 0.05)',
        'float-dropdown': '0 1rem 2.25rem -1.125rem oklch(0.2161 0.0061 56.04 / 0.5)',
        'float-popover': '0 1.125rem 2.5rem -1.5rem oklch(0.2161 0.0061 56.04 / 0.5)',
        'float-modal': '0 1.75rem 3.5rem -1.5rem oklch(0.2161 0.0061 56.04 / 0.45)',
        'focus-lift': '0 0.0625rem 0.125rem oklch(0.2161 0.0061 56.04 / 0.08), 0 0.625rem 1.25rem -0.875rem oklch(0.5832 0.227 268.34 / 0.6)',
        'card': '0 0.0625rem 0.125rem oklch(0.2161 0.0061 56.04 / 0.06), 0 0.25rem 0.625rem -0.5rem oklch(0.2161 0.0061 56.04 / 0.45)',
      },
      letterSpacing: {
        tightest: '-0.03em',
        tighter: '-0.02em',
      },
    },
  },
  plugins: [],
}
