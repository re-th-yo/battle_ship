/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Palette battle.shxp
        'lime':     '#C5FF00',   // vert lime — accent principal, mode attaque
        'magenta':  '#FF00FF',   // lignes déco, ciblage
        'blue-px':  '#0000FF',   // tourelles, bordures mode layout
        'red-rdr':  '#FF0000',   // radar
        'purple-gltch': '#7B2CBF', // brouilleur
        'pink-msl': '#FF1493',   // silo missiles
        'dark':     '#0A0A0A',   // fond principal
        'dark-mid': '#111111',   // fond secondaire
        'dark-panel': '#1A1A1A', // panneaux
        'gray-unit': '#2A2A2A',  // générateurs
        'lime-dim': '#8AAF00',   // lime atténué pour textes secondaires
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Space Mono"', '"Courier New"', 'monospace'],
      },
      fontSize: {
        'xxs': '0.625rem', // 10px — petites étiquettes
      },
      // Coins biseautés via clip-path — nommés pour réutilisation
      clipPath: {
        'panel': 'polygon(12px 0%, 100% 0%, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0% 100%, 0% 12px)',
        'panel-lg': 'polygon(20px 0%, 100% 0%, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0% 100%, 0% 20px)',
      },
      animation: {
        'glitch': 'glitch 0.3s steps(2) infinite',
        'scanline': 'scanline 4s linear infinite',
        'blink': 'blink 1s step-end infinite',
      },
      keyframes: {
        glitch: {
          '0%':   { transform: 'translate(0)' },
          '20%':  { transform: 'translate(-2px, 2px)' },
          '40%':  { transform: 'translate(2px, -2px)' },
          '60%':  { transform: 'translate(-2px, -2px)' },
          '80%':  { transform: 'translate(2px, 2px)' },
          '100%': { transform: 'translate(0)' },
        },
        scanline: {
          '0%':   { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '0 100%' },
        },
        blink: {
          '0%, 100%': { opacity: 1 },
          '50%':      { opacity: 0 },
        },
      },
    },
  },
  plugins: [],
}
