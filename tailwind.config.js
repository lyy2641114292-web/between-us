/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      // 与原型 6.html 的 tailwind.config 逐项一致
      colors: {
        abyss: '#050911',
        deepsea: '#0A1324',
        mistblue: '#4A6B82',
        slatefrost: '#8BA6BC',
        greypurple: '#2A2B42',
        mutedviolet: '#525174',
        mistwhite: '#E6ECF2',
        coral: '#FF6B4A',
        warmorange: '#f28c38',
        celestial: '#5da9e9',
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', '"Noto Serif SC"', 'serif'],
        sans: ['"Inter"', '"Noto Sans SC"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      // 注意：不补 duration-400。
      // 原型 Tailwind v3 默认刻度为 0/75/100/150/200/300/500/700/1000，没有 400，
      // 因此原型中的 duration-400 本就是空类；补上反而会偏离原型。
      // opacity-55 / opacity-85 属于 v3 默认刻度，无需声明。
    },
  },
  plugins: [],
}
