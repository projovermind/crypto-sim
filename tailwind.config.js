/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'binance': {
          'bg': '#11141A',
          'card': '#11141A',
          'border': '#303238',
          'text': '#EAECEF',
          'text-dim': '#818693',
          'green': '#00BF75',
          'red': '#FF3D55',
          'yellow': '#FFBB00',
          'blue': '#1E80FF',
          'input': '#202125',
          'hover': '#4A4C52',
        }
      },
      fontFamily: {
        'sans': ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        'mono': ['DM Mono', 'Roboto Mono', 'monospace'],
      }
    },
  },
  plugins: [],
}
