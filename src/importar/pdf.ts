import * as pdfjs from 'pdfjs-dist'
import urlDelTrabajador from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// El trabajador se empaqueta con la app: el PDF se lee sin internet.
pdfjs.GlobalWorkerOptions.workerSrc = urlDelTrabajador

export interface PaginaPdf {
  numero: number
  texto: string
}

export async function extraerTextoPdf(
  archivo: File,
  alAvanzar?: (hecha: number, total: number) => void,
): Promise<PaginaPdf[]> {
  const datos = new Uint8Array(await archivo.arrayBuffer())
  const documento = await pdfjs.getDocument({ data: datos }).promise
  const paginas: PaginaPdf[] = []

  for (let n = 1; n <= documento.numPages; n++) {
    const pagina = await documento.getPage(n)
    const contenido = await pagina.getTextContent()
    let texto = ''
    let ultimoY: number | null = null
    for (const trozo of contenido.items) {
      if (!('str' in trozo)) continue
      const y = Math.round((trozo.transform?.[5] ?? 0) as number)
      if (ultimoY !== null && Math.abs(y - ultimoY) > 2) texto += '\n'
      texto += trozo.str
      if ('hasEOL' in trozo && trozo.hasEOL) texto += '\n'
      ultimoY = y
    }
    paginas.push({ numero: n, texto: limpiar(texto) })
    alAvanzar?.(n, documento.numPages)
  }

  await documento.destroy()
  return paginas
}

/** Junta palabras cortadas por guión al final de línea y aprieta espacios. */
function limpiar(texto: string): string {
  return texto
    .replace(/-\n(?=[a-zá-úñ])/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
