/** @type {import('tailwindcss').Config} */
export default {
    content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
    theme: {
        extend: {
            colors: {
                aqua: {
                    dark: '#1A428A',   // Bottom wave
                    brand: '#009CDE',   // Middle wave
                    accent: '#66C7C5',   // Top wave
                },
                ripple: '#8CC63F',  // Drop & "Ripple" text
            },
        },
    },
    plugins: [],
}