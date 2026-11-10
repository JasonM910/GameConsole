/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        arcade: {
          void: '#0b0b16',
          panel: '#151527',
          raised: '#1d1b35',
          line: '#373252',
          lime: '#ccff33',
          cyan: '#41f5ff',
          pink: '#ff4fd8',
          gold: '#ffdc69',
          muted: '#a39ab9',
        },
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', 'monospace'],
        mono: ['"Space Mono"', 'monospace'],
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pixel-glow': {
          '0%, 100%': { boxShadow: '0 0 0 2px #0b0b16, 0 0 12px rgba(204,255,51,.24)' },
          '50%': { boxShadow: '0 0 0 2px #0b0b16, 0 0 24px rgba(204,255,51,.66)' },
        },
        'arcade-float': {
          '0%, 100%': { translate: '0 0', rotate: '-2deg' },
          '50%': { translate: '0 -9px', rotate: '2deg' },
        },
        'piece-drop': {
          '0%': { opacity: '0', transform: 'translateY(-8px) scale(.8)' },
          '75%': { opacity: '1', transform: 'translateY(2px) scale(1.05)' },
          '100%': { transform: 'translateY(0) scale(1)' },
        },
        'blink-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '.45' },
        },
      },
      animation: {
        'fade-up': 'fade-up .55s cubic-bezier(.2,.8,.2,1) both',
        'pixel-glow': 'pixel-glow 2.4s ease-in-out infinite',
        'arcade-float': 'arcade-float 4s ease-in-out infinite',
        'piece-drop': 'piece-drop .28s ease-out both',
        'blink-soft': 'blink-soft 1.4s steps(2, start) infinite',
      },
    },
  },
  plugins: [],
};
