// tailwind.config.js - Optimized for mobile-first design
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      colors: {
        'primary-blue': '#2563EB', // Your primary brand color
        'secondary-green': '#10B981', // Another brand color
        'accent-yellow': '#F59E0B',
        // Define your own shades based on your theme
      },
      fontFamily: {
        'inter': ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      screens: {
        'xs': '475px',      // Extra small devices
        'sm': '640px',      // Small devices (default)
        'md': '768px',      // Medium devices (default)
        'lg': '1024px',     // Large devices (default)
        'xl': '1280px',     // Extra large devices (default)
        '2xl': '1536px',    // 2X large devices (default)
        // iPhone specific breakpoints
        'iphone-se': '375px',
        'iphone': '414px',
        'iphone-plus': '428px',
      },
      spacing: {
        '18': '4.5rem',     // 72px
        '88': '22rem',      // 352px
        '104': '26rem',     // 416px
        '112': '28rem',     // 448px
        '128': '32rem',     // 512px
      },
      maxWidth: {
        'xs': '20rem',      // 320px
        '8xl': '88rem',     // 1408px
        '9xl': '96rem',     // 1536px
      },
      height: {
        '18': '4.5rem',     // 72px
        '112': '28rem',     // 448px
        '128': '32rem',     // 512px
      },
      // Touch-friendly sizing
      minHeight: {
        '12': '3rem',       // 48px minimum touch target
        '16': '4rem',       // 64px
      },
      // Safe area insets for iOS
      padding: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      },
    },
  },
  plugins: [],
};
