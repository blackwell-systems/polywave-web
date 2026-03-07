/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  safelist: [
    'border-l-gray-400',
    'border-l-green-500',
    'border-l-amber-500',
    'border-l-cyan-500',
    'border-l-rose-500',
    'border-l-indigo-500',
  ],
  theme: { extend: {} },
  plugins: [],
}
