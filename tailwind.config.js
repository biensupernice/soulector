module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    fontFamily: {
      body: [
        "'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;"
      ],
    },
    extend: {
      colors: {
        accent: 'rgb(var(--accent) / <alpha-value>)',
      },
      spacing: {
        "safe-top": "env(safe-area-inset-top, 20px)",
        "safe-bottom": "env(safe-area-inset-bottom, 20px)",
        "safe-left": "env(safe-area-inset-left)",
        "safe-right": "env(safe-area-inset-right)",
      },
    },
  },
  plugins: [],
}
