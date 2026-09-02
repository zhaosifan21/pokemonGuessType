import postcss from 'postcss'
import Px2rem from 'px2rem'

function px2rem(options) {
  return {
    postcssPlugin: 'px2rem',
    Once(root) {
      const transformedCss = new Px2rem(options).generateRem(root.toString())
      const transformedRoot = postcss.parse(transformedCss, {
        from: root.source?.input.file,
      })

      root.removeAll()
      root.append(transformedRoot.nodes)
    },
  }
}

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
