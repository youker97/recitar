// Achicar una foto antes de guardarla.
//
// La app guarda todo en el navegador: meter una foto de 4 MB dentro de los
// ajustes es la forma más rápida de llenar la cuota y que deje de guardar. Se
// recorta al centro, se baja a 256 px y se guarda como JPEG.

const LADO = 256

export async function aEscudo(archivo: File): Promise<string> {
  const mapa = await crearMapa(archivo)
  const lienzo = document.createElement('canvas')
  lienzo.width = LADO
  lienzo.height = LADO
  const pincel = lienzo.getContext('2d')
  if (!pincel) throw new Error('El navegador no deja procesar la imagen.')

  // Recorte cuadrado al centro: el escudo se muestra redondo.
  const lado = Math.min(mapa.width, mapa.height)
  const x = (mapa.width - lado) / 2
  const y = (mapa.height - lado) / 2
  pincel.drawImage(mapa, x, y, lado, lado, 0, 0, LADO, LADO)
  if ('close' in mapa) mapa.close()
  return lienzo.toDataURL('image/jpeg', 0.85)
}

async function crearMapa(archivo: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(archivo)
    } catch {
      // Safari viejo con algunos formatos: se cae al camino de abajo.
    }
  }
  const url = URL.createObjectURL(archivo)
  try {
    return await new Promise<HTMLImageElement>((listo, falla) => {
      const img = new Image()
      img.onload = () => listo(img)
      img.onerror = () => falla(new Error('No se pudo leer la imagen.'))
      img.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}
