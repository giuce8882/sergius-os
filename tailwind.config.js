/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        glass: {
          light: 'rgba(255, 255, 255, 0.4)',
          border: 'rgba(255, 255, 255, 0.5)',
          dark: 'rgba(0, 0, 0, 0.6)',
          darkBorder: 'rgba(255, 255, 255, 0.05)',
        }
      },
      backdropBlur: {
        'liquid': '24px',
        'heavy': '40px',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
        'glass-inset': 'inset 0 0 0 1px rgba(255, 255, 255, 0.3)',
      },
      animation: {
        'gradient': 'gradient 8s ease infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        gradient: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        float: {
          '0%, 100%': { transform: 'translate3d(0, 0, 0) scale(1)' },
          '50%': { transform: 'translate3d(0, -20px, 0) scale(1.05)' },
        }
      }
    },
  },
  plugins: [],
}
