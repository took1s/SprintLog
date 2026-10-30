const path = require('node:path');

/**
 * Alle Farben zeigen auf Design-Tokens (src/styles/themes.css). Damit werden auch bestehende Klassen
 * themenfähig: "text-white" = stärkster Vordergrund, "bg-white/5" = feine Fläche in Vordergrundfarbe,
 * "text-slate-400" = gedämpfter Text, "red/emerald/orange/yellow/purple" = Statusfarben.
 * Text- und Flächenfarbe sind getrennt (z. B. Lime als Fläche, dunkles Grün als Text im hellen Theme).
 */
const v = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;
const ramp = (name) => Object.fromEntries([50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((s) => [s, v(name)]));

const neutral = {
  50: v('fg'), 100: v('fg'), 200: v('fg-2'), 300: v('fg-2'), 400: v('muted'),
  500: v('subtle'), 600: v('faint'), 700: v('faint'), 800: v('surface-2'), 900: v('surface'), 950: v('bg'),
};

/** Flächen-/Rahmenfarben */
const surfaceColors = {
  transparent: 'transparent',
  current: 'currentColor',
  inherit: 'inherit',
  white: v('fg'),
  black: v('well'),
  ink: v('bg'),
  bg: v('bg'),
  surface: v('surface'),
  'surface-2': v('surface-2'),
  fg: v('fg'),
  line: v('fg'),
  accent: v('accent'),
  'on-accent': v('on-accent'),
  slate: neutral,
  gray: neutral,
  red: ramp('danger'),
  rose: ramp('danger'),
  emerald: ramp('success'),
  green: ramp('success'),
  orange: ramp('warn'),
  amber: ramp('warn'),
  yellow: ramp('gold'),
  purple: ramp('gym'),
  violet: ramp('gym'),
};

/** Textfarben: Status- und Akzentfarben in der lesbaren Text-Variante */
const textColors = {
  ...surfaceColors,
  black: v('on-accent'), // "text-black" steht nur auf Akzentflächen
  accent: v('accent-text'),
  muted: v('muted'),
  subtle: v('subtle'),
  red: ramp('danger-text'),
  rose: ramp('danger-text'),
  emerald: ramp('success-text'),
  green: ramp('success-text'),
  orange: ramp('warn-text'),
  amber: ramp('warn-text'),
  yellow: ramp('gold-text'),
  purple: ramp('gym-text'),
  violet: ramp('gym-text'),
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [path.join(__dirname, 'index.html'), path.join(__dirname, 'src/**/*.{vue,ts}')],
  theme: {
    colors: surfaceColors,
    textColor: textColors,
    extend: {
      fontFamily: {
        sans: ['var(--font-body)'],
        display: ['var(--font-display)'],
        mono: ['var(--font-num)'],
      },
      borderRadius: {
        DEFAULT: 'var(--r-sm)',
        md: 'var(--r-sm)',
        lg: 'var(--r-md)',
        xl: 'var(--r-md)',
        '2xl': 'var(--r-lg)',
        '3xl': 'var(--r-xl)',
        full: 'var(--r-pill)',
        circle: '9999px',
      },
      boxShadow: {
        glow: 'var(--glow)',
      },
    },
  },
  plugins: [],
};
