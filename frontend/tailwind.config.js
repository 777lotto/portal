// 777lotto/portal/portal-bet/frontend/tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // We will use a class to enable dark mode
  theme: {
    extend: {
      colors: {
        // Your neutral color palette
        'primary-dark': '#1a1d20', // Darkest background
        'secondary-dark': '#212529',
        'tertiary-dark': '#343a40', // Card background in dark mode
        'primary-light': '#ffffff', // Lightest background
        'secondary-light': '#f8f9fa', // Card background in light mode
        'border-dark': '#495057',
        'border-light': '#dee2e6',
        'text-primary-dark': '#dee2e6',
        'text-secondary-dark': '#adb5bd',
        'text-primary-light': '#212529',
        'text-secondary-light': '#495057',

        // MODIFIED: Use your brand's specific highlight colors
        'event-blue': '#0000FF',
        'event-green': '#00FF00',
        'event-red': '#FF0000',
      }
    },
  },
  plugins: [],
}
