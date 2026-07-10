/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eef5ff',
          100: '#daeaff',
          200: '#bdd7ff',
          300: '#90beff',
          400: '#609cfc',
          500: '#3b77f8',
          600: '#2256ed',
          700: '#1a41d9',
          800: '#1c35b0',
          900: '#1c318a',
          950: '#151f54',
        },
        surface: {
          0:   '#ffffff',
          50:  '#f8faff',
          100: '#f0f4fd',
          200: '#e2eafb',
          300: '#ccd8f7',
        },
      },
      backgroundImage: {
        'gradient-brand':   'linear-gradient(135deg,#1a41d9 0%,#3b77f8 60%,#609cfc 100%)',
        'gradient-premium': 'linear-gradient(135deg,#0f1c4d 0%,#1a41d9 50%,#2256ed 100%)',
        'gradient-card':    'linear-gradient(145deg,rgba(255,255,255,0.95) 0%,rgba(240,244,253,0.9) 100%)',
        'gradient-dark':    'linear-gradient(135deg,#0b1437 0%,#151f54 60%,#1a41d9 100%)',
      },
      boxShadow: {
        'card':     '0 2px 16px rgba(34,86,237,0.08), 0 1px 3px rgba(0,0,0,0.05)',
        'card-lg':  '0 8px 40px rgba(34,86,237,0.14), 0 2px 8px rgba(0,0,0,0.06)',
        'brand':    '0 4px 20px rgba(59,119,248,0.35)',
        'brand-lg': '0 8px 32px rgba(59,119,248,0.45)',
        'float':    '0 20px 60px rgba(15,28,77,0.22)',
        'glow':     '0 0 24px rgba(59,119,248,0.5)',
      },
      borderRadius: {
        '2.5xl': '20px',
        '3xl':   '24px',
        '4xl':   '32px',
      },
      fontFamily: {
        sans: ["'Inter'", '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      animation: {
        'fade-in':     'fadeIn 0.45s ease-out',
        'slide-up':    'slideUp 0.45s cubic-bezier(0.16,1,0.3,1)',
        'slide-down':  'slideDown 0.3s cubic-bezier(0.16,1,0.3,1)',
        'scale-in':    'scaleIn 0.3s cubic-bezier(0.16,1,0.3,1)',
        'pulse-slow':  'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'shimmer':     'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeIn:    { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp:   { '0%': { opacity: '0', transform: 'translateY(20px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        slideDown: { '0%': { opacity: '0', transform: 'translateY(-12px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        scaleIn:   { '0%': { opacity: '0', transform: 'scale(0.94)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        shimmer:   { '0%': { backgroundPosition: '-400px 0' }, '100%': { backgroundPosition: '400px 0' } },
      },
    },
  },
  plugins: [],
}
