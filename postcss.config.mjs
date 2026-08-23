/**
 * Tailwind v4 มาเป็นปลั๊กอิน PostCSS แยกตัว (@tailwindcss/postcss)
 * และรวม autoprefixer + postcss-import ไว้ในตัวแล้ว จึงไม่ต้องประกาศเพิ่ม
 */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
