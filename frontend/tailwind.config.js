/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Deep "reading-room" green used for navigation and primary actions
        ink: {
          50: '#f1f6f4',
          100: '#dce9e4',
          200: '#b9d3c9',
          300: '#8db5a7',
          400: '#5f9282',
          500: '#437766',
          600: '#335f52',
          700: '#2a4d43',
          800: '#1f3a33',
          900: '#152a25',
          950: '#0d1c18',
        },
        // Warm brass accent
        brass: {
          50: '#fbf6ec',
          100: '#f5e8cc',
          200: '#ebcf96',
          300: '#dfb262',
          400: '#d4993d',
          500: '#bf7f2b',
          600: '#a26323',
          700: '#824a21',
          800: '#6b3d21',
          900: '#5a341f',
        },
        paper: '#f7f5f0',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'Cambria', 'serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(21, 42, 37, 0.06), 0 1px 3px rgba(21, 42, 37, 0.04)',
        lifted: '0 10px 30px -12px rgba(21, 42, 37, 0.25)',
      },
    },
  },
  plugins: [],
};
