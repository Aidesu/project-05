/**
 * Average colour of an image, sampled at low resolution since only a rough
 * accent is needed. Resolves to `null` if the image can't be read (a
 * network failure, a decode error, or a cross-origin source without CORS
 * headers tainting the canvas), so callers can fall back to a neutral look.
 */
export function averageColorFromUrl(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = "anonymous"

    img.onload = () => {
      try {
        const size = 8
        const canvas = document.createElement("canvas")
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          resolve(null)
          return
        }

        ctx.drawImage(img, 0, 0, size, size)
        const { data } = ctx.getImageData(0, 0, size, size)

        let r = 0
        let g = 0
        let b = 0
        const pixels = data.length / 4
        for (let i = 0; i < data.length; i += 4) {
          r += data[i]
          g += data[i + 1]
          b += data[i + 2]
        }

        const toHex = (channel: number) =>
          Math.round(channel / pixels)
            .toString(16)
            .padStart(2, "0")

        resolve(`#${toHex(r)}${toHex(g)}${toHex(b)}`)
      } catch {
        resolve(null)
      }
    }

    img.onerror = () => resolve(null)
    img.src = url
  })
}
