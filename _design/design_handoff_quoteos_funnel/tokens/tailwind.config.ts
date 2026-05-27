// tailwind.config.ts — FencePros QuoteOS
// Drop this in at the root of the Next.js project.
// Exact brand tokens from FencePros Brand Guidelines v1.0.

import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './pages/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Anchor Navy — primary brand surface
        navy:         '#1A2A4A',
        'navy-deep':  '#121C33',
        'navy-soft':  '#2A3A5C',

        // Storm Brick — EMPHASIS ONLY (CTAs, price numerals, "PROS")
        brick:        '#8B2332',
        'brick-deep': '#6E1A26',

        // Picket Brass — TRIM ONLY (rules, dashes, borders, pickets)
        brass:        '#C8962E',
        'brass-soft': '#E0B452',

        // Tulsa Cream — paper surface
        cream:        '#F4F1E8',
        'cream-deep': '#E9E4D3',
        paper:        '#FBF8F0',

        // Neutrals
        ink:          '#15161A',  // body text
        char:         '#2C2F36',  // secondary text
        steel:        '#6B6F76',  // captions
        'steel-soft': '#A7ABB2',  // disabled / mist
      },
      fontFamily: {
        display: ['Oswald', 'Arial Narrow', 'sans-serif'],
        body:    ['"Source Sans 3"', 'system-ui', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        sans:    ['"Source Sans 3"', 'system-ui', 'sans-serif'], // default
      },
      fontSize: {
        // Type scale — web baseline
        // h1 hero/cover only
        'd-h1':     ['84px', { lineHeight: '0.95',  letterSpacing: '-0.01em' }],
        // h2 section
        'd-h2':     ['56px', { lineHeight: '1.0',   letterSpacing: '0.02em'  }],
        // h3 sub
        'd-h3':     ['28px', { lineHeight: '1.1',   letterSpacing: '0.06em'  }],
        // h4 eyebrow / label
        'd-h4':     ['18px', { lineHeight: '1.2',   letterSpacing: '0.12em'  }],
        // lead paragraph
        'lead':     ['21px', { lineHeight: '1.5' }],
        // body
        'body':     ['16px', { lineHeight: '1.55' }],
        // small / caption
        'small':    ['13px', { lineHeight: '1.5' }],
      },
      letterSpacing: {
        tightest: '-0.015em',
        eyebrow:  '0.12em',
        spec:     '0.18em',
      },
      borderRadius: {
        // Brand uses 2-3px corners — heritage / industrial, not rounded SaaS
        DEFAULT: '2px',
        'sm':    '2px',
        'md':    '3px',
        'lg':    '4px',
        'pill':  '999px',
      },
      boxShadow: {
        // Document / card lifts
        'card':       '0 1px 0 rgba(0,0,0,.04), 0 12px 30px -18px rgba(18,28,51,.4)',
        'card-lg':    '0 24px 60px -30px rgba(18,28,51,.35)',
        'cta':        '0 1px 0 rgba(0,0,0,.08), 0 8px 24px -12px rgba(110,26,38,.55)',
        'modal':      '0 30px 80px rgba(18,28,51,.35)',
        'map':        '0 30px 80px -30px rgba(0,0,0,.6)',
      },
    },
  },
  plugins: [],
};

export default config;
