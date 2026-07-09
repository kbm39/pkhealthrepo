/**
 * Resizes an image file down to a max dimension and returns raw base64 data
 * (no data: URL prefix) plus its media type, ready to send to the Anthropic
 * API's image content blocks.
 */
export function resizeImageToBase64(
  file: File,
  maxDimension: number
): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)

      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height))
      const width = Math.round(img.width * scale)
      const height = Math.round(img.height * scale)

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Could not process image'))
        return
      }
      ctx.drawImage(img, 0, 0, width, height)

      const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
      const base64 = dataUrl.split(',')[1]
      resolve({ base64, mediaType: 'image/jpeg' })
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Could not load image'))
    }

    img.src = objectUrl
  })
}
