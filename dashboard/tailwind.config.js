/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class', // Enable class-based dark mode
    theme: {
        extend: {
            fontFamily: {
                sans: ['DM Sans', 'sans-serif'],
                display: ['Oswald', 'sans-serif'], // For titles
            },
            colors: {
                primary: 'var(--color-primary)',
                secondary: 'var(--color-secondary)',
                accent: 'var(--color-accent)',
                main: 'var(--text-main)',
                light: 'var(--text-light)',
                subtle: 'var(--bg-subtle)',
                paper: 'var(--bg-body)',
            },
            boxShadow: {
                'card': 'var(--shadow-card)',
                'hard': '4px 4px 0px 0px rgba(0,0,0,1)',
            },
            borderRadius: {
                'paper': 'var(--border-radius)',
            }
        },
    },
    plugins: [],
}
