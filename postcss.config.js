import px2rem from 'postcss-px2rem'

export default {
  plugins: [
    px2rem({
      // Keep the design unit predictable: 16px in source CSS becomes 1rem.
      remUnit: 16,
      remPrecision: 5,
      // Avoid changing hairlines and very small borders.
      minPixelValue: 1,
    }),
  ],
}
