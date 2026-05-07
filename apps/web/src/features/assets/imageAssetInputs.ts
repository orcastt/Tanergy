'use client'

export const acceptedImageMimeTypes = ['image/png', 'image/jpeg', 'image/webp']
export const imageMaxBytes = 100 * 1024 * 1024

export function validateImageFile(file: File) {
  if (!acceptedImageMimeTypes.includes(file.type)) {
    throw new Error('Use PNG, JPEG, or WebP.')
  }
  if (file.size > imageMaxBytes) {
    throw new Error('Image must be 100MB or smaller.')
  }
}

export async function readImageFileMetadata(file: File) {
  const objectUrl = URL.createObjectURL(file)
  try {
    const dimensions = await new Promise<{ height: number; width: number }>((resolve, reject) => {
      const image = new window.Image()
      image.decoding = 'async'
      image.onerror = () => reject(new Error('Failed to decode image.'))
      image.onload = () => resolve({ height: image.naturalHeight, width: image.naturalWidth })
      image.src = objectUrl
    })
    return dimensions
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export async function readImageFileAsDataUrl(file: File) {
  const url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Failed to read image file.'))
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.readAsDataURL(file)
  })

  const dimensions = await decodeImageDimensions(url)

  return { ...dimensions, url }
}

function decodeImageDimensions(src: string) {
  return new Promise<{ height: number; width: number }>((resolve, reject) => {
    const image = new window.Image()
    image.decoding = 'async'
    image.onerror = () => reject(new Error('Failed to decode image.'))
    image.onload = () => resolve({ height: image.naturalHeight, width: image.naturalWidth })
    image.src = src
  })
}
