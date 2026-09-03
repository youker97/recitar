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
    const lineas: string[] = []
    let linea = ''
    let ultimoY: number | null = null
    for (const trozo of contenido.items) {
      if (!('str' in trozo)) continue
      const y = Math.round((trozo.transform?.[5] ?? 0) as number)
      const cambioDeLinea = ultimoY !== null && Math.abs(y - ultimoY) > 2
      if (cambioDeLinea && linea.trim()) { lineas.push(linea); linea = '' }
      linea += trozo.str
      if ('hasEOL' in trozo && trozo.hasEOL) {
        if (linea.trim()) lineas.push(linea)
        linea = ''
      }
      ultimoY = y
    }
    if (linea.trim()) lineas.push(linea)

    paginas.push({ numero: n, texto: reflujo(lineas) })
    alAvanzar?.(n, documento.numPages)
  }

  await documento.destroy()
  return paginas
}

/**
 * Un PDF entrega una línea por renglón visual, cortada a mitad de frase. Leer
 * eso es horrible y además parte los párrafos en pedazos inservibles. Acá se
 * rearman los párrafos: las líneas se pegan salvo cuando de verdad termina una
 * idea, y los títulos se dejan solos.
 */
function reflujo(lineas: string[]): string {
  const parrafos: string[] = []
  let actual = ''

  const cierra = (l: string) => /[.:;!?]["»)]?$/.test(l)
  const corta = (l: string) => l.length < 55
  const soloMayusculas = (l: string) => !/\p{Ll}/u.test(l) && /\p{Lu}/u.test(l)
  const numerada = (l: string) => /^\s*(?:\d{1,2}(?:\.\d{1,2})*|[IVXLCDM]{1,7}|[a-zA-Z])\s*[.)\-–]/.test(l)

  const cerrar = () => {
    if (actual.trim()) parrafos.push(actual.trim())
    actual = ''
  }

  for (const cruda of lineas) {
    const l = cruda.replace(/[ \t]+/g, ' ').trim()
    if (!l) { cerrar(); continue }

    // Títulos: van solos, sin pegarse a lo que viene.
    if (soloMayusculas(l) || (corta(l) && numerada(l))) {
      cerrar()
      parrafos.push(l)
      continue
    }

    // Palabra cortada con guión al final del renglón.
    if (/[a-zá-úñ]-$/.test(actual)) actual = actual.slice(0, -1) + l
    else actual = actual ? `${actual} ${l}` : l

    // Última línea de un párrafo: corta y terminada en punto.
    if (cierra(l) && corta(l)) cerrar()
  }
  cerrar()

  return parrafos.join('\n\n').replace(/\n{3,}/g, '\n\n').trim()
}
