/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        warm: {
          bg: '#faf7f2',
          surface: '#ffffff',
          surface2: '#f5f0e8',
          border: '#e8ddcc',
          'border-strong': '#d4c4a8',
          text: '#2d2218',
          'text-dim': '#8b8070',
          'text-muted': '#b8a890',
          accent: '#d97706',
          'accent-hover': '#b65f00',
          'accent-soft': '#fef3c7',
          'accent-glow': '#f59e0b',
          danger: '#dc2626',
          'danger-soft': '#fef2f2',
          success: '#16a34a',
          'success-soft': '#f0fdf4',
        },
      },
    },
  },
  plugins: [],
}
