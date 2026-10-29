/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './SprintLog.Api/wwwroot/index.html',
    './SprintLog.Api/wwwroot/js/**/*.js',
  ],
  theme: {
    extend: {
      colors: {
        accent: '#00c3ff',
        ink: '#02040a',
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
