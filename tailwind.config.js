/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#05050B',
          900: '#08070F',
          850: '#0B0A15',
          800: '#100E1C',
          700: '#171427',
          600: '#1F1B33',
          500: '#2A2544',
        },
        violet: {
          400: '#A78BFA',
          500: '#8B5CF6',
          600: '#7C3AED',
        },
        cyan: {
          400: '#22D3EE',
          500: '#06B6D4',
        },
        mint: {
          400: '#34D399',
          500: '#10B981',
        },
        ember: {
          400: '#FB923C',
          500: '#F97316',
        },
        rose: {
          400: '#FB7185',
          500: '#F43F5E',
        },
      },
      fontFamily: {
        sans: ['Inter Variable', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        pixel: ['Silkscreen', 'JetBrains Mono', 'monospace'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        glow: '0 0 40px -12px rgba(139, 92, 246, 0.55)',
        'glow-sm': '0 0 24px -10px rgba(139, 92, 246, 0.6)',
        card: '0 24px 60px -30px rgba(0, 0, 0, 0.9)',
        inset: 'inset 0 1px 0 0 rgba(255,255,255,0.06)',
      },
      backgroundImage: {
        brand: 'linear-gradient(120deg, #A855F7 0%, #6366F1 45%, #22D3EE 100%)',
        'brand-soft':
          'linear-gradient(120deg, rgba(168,85,247,0.16) 0%, rgba(99,102,241,0.14) 45%, rgba(34,211,238,0.16) 100%)',
        'grid-fade':
          'radial-gradient(circle at 50% 0%, rgba(139,92,246,0.20), transparent 60%)',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '50%': { transform: 'translate3d(0,-18px,0) scale(1.04)' },
        },
        drift: {
          '0%, 100%': { transform: 'translate3d(0,0,0)' },
          '33%': { transform: 'translate3d(24px,-16px,0)' },
          '66%': { transform: 'translate3d(-18px,12px,0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateX(24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'pulse-ring': {
          '0%': { boxShadow: '0 0 0 0 rgba(52,211,153,0.45)' },
          '70%': { boxShadow: '0 0 0 12px rgba(52,211,153,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(52,211,153,0)' },
        },
        spin: { to: { transform: 'rotate(360deg)' } },
      },
      animation: {
        float: 'float 12s ease-in-out infinite',
        drift: 'drift 18s ease-in-out infinite',
        shimmer: 'shimmer 2.4s linear infinite',
        'fade-up': 'fade-up 0.5s cubic-bezier(0.16,1,0.3,1) both',
        'fade-in': 'fade-in 0.35s ease-out both',
        'scale-in': 'scale-in 0.22s cubic-bezier(0.16,1,0.3,1) both',
        'slide-in': 'slide-in 0.35s cubic-bezier(0.16,1,0.3,1) both',
        'pulse-ring': 'pulse-ring 2s ease-out infinite',
      },
    },
  },
  plugins: [],
};
