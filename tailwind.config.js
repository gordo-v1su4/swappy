import { fontFamily } from 'tailwindcss/defaultTheme';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './src/**/*.{html,js,svelte,ts}',
    './node_modules/bits-ui/dist/**/*.{js,ts,svelte}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        // Main backgrounds
        background: '#111827',
        'background-lighter': '#1F2937',
        
        // Text colors
        primary: '#F9FAFB',
        secondary: '#9CA3AF',
        
        // Accent colors
        accent: '#2DD4BF',
        'accent-hover': '#14B8A6',
        
        // UI States
        disabled: '#374151',
        error: '#EF4444',
        warning: '#F59E0B',
        
        // Component colors
        border: '#374151',
        ring: '#2DD4BF',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['Inter var', 'SF Pro Display', 'system-ui', 'sans-serif'],
      },
      gridTemplateColumns: {
        'app': '240px 1fr 320px', // Left sidebar, main content, right panel
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} 