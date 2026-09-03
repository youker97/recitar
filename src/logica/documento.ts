// Convertir el texto plano de un apunte en un documento con forma.
//
// El texto que sale de un PDF o de un .txt no trae estructura: llega todo como
// párrafos sueltos, con los números de página metidos entre medio y los
// títulos indistinguibles de una frase cualquiera. Leerlo así es leer un
// muro. Acá se reconoce lo que ya está en el texto —títulos, citas de
// artículos, enumeraciones— para poder mostrarlo como se ve en un apunte
// bien hecho.
//
// Solo se reconoce; no se inventa ni se reescribe nada.

export type Bloque =
  | { clase: 'titulo'; nivel: 1 | 2 | 3; texto: string }
  | { clase: 'cita'; fuente: string | null; texto: string }
  | { clase: 'lista'; ordenada: boolean; puntos: string[] }
  | { clase: 'parrafo'; texto: string }

/** Números de página y marcas de visor que el extractor deja sueltos. */
const BASURA = /^(?:\d{1,4}|p[áa]g(?:ina)?s?\.?\s*\d{1,4}|\d{1,4}\s*(?:de|\/)\s*\d{1,4})[.\s]*$/i

/** Una cita completa entre comillas de cualquier tipo. */
const ENTRECOMILLADO = /^[«"“](.+)[»"”][.\s]*$/s

/** "Art. 1489", "Artículo 578 del Código Civil". */
const ARTICULO = /^\s*(arts?\.?|art[íi]culos?)\s*[\d]+[^\s,;:.]*(?:\s+(?:del?|de la)\s+[^,;:.]{3,40})?/i

/** Viñetas y numeraciones de una enumeración. */
const MARCA = '(?:[-–—•*]|\\(?\\d{1,2}[.)]|\\(?[a-zñ][.)])'
/** Para detectar: exige que haya algo escrito después de la viñeta. */
const VINETA = new RegExp(`^\\s*${MARCA}\\s+\\S`, 'i')
/** Para quitarla: sin el \\S, o se llevaría la primera letra del punto. */
const QUITA_VINETA = new RegExp(`^\\s*${MARCA}\\s+`, 'i')
const VINETA_ORDENADA = /^\s*\(?(?:\d{1,2}|[a-zñ])[.)]\s+/i

const ROMANO = '[IVXLCDM]{1,7}'
const SEPARADOR = '\\s*[.)\\-–]{1,3}\\s*'

export function aDocumento(texto: string): Bloque[] {
  const salida: Bloque[] = []

  for (const bruto of texto.split(/\n\s*\n/)) {
    const lineas = bruto.split('\n').map((l) => l.trim()).filter(Boolean)
    if (lineas.length === 0) continue

    // Una enumeración: se conserva línea por línea en vez de pegarla toda.
    const conVineta = lineas.filter((l) => VINETA.test(l)).length
    if (lineas.length >= 2 && conVineta >= lineas.length - 1 && conVineta >= 2) {
      salida.push({
        clase: 'lista',
        ordenada: lineas.every((l) => VINETA_ORDENADA.test(l)),
        puntos: lineas.map((l) => l.replace(QUITA_VINETA, '').trim()),
      })
      continue
    }

    const parrafo = lineas.join(' ').replace(/\s+/g, ' ').trim()
    if (!parrafo || BASURA.test(parrafo)) continue

    const nivel = nivelDeTitulo(parrafo)
    if (nivel) {
      salida.push({ clase: 'titulo', nivel, texto: parrafo })
      continue
    }

    const entre = ENTRECOMILLADO.exec(parrafo)
    if (entre && entre[1].length > 40) {
      salida.push(citar(entre[1]))
      continue
    }
    if (ARTICULO.test(parrafo) && parrafo.length > 60) {
      salida.push(citar(parrafo))
      continue
    }

    salida.push({ clase: 'parrafo', texto: parrafo })
  }

  return salida
}

/** Devuelve 1, 2 o 3 si la línea es un título; null si es texto corriente. */
function nivelDeTitulo(linea: string): 1 | 2 | 3 | null {
  const marcado = /^(#{1,4})\s+(.+)$/.exec(linea)
  if (marcado) return Math.min(3, marcado[1].length) as 1 | 2 | 3

  if (linea.length > 90) return null
  const palabras = linea.split(/\s+/).length
  if (palabras > 12) return null
  // Un título no termina en coma ni en punto y coma, y no trae punto seguido.
  if (/[,;:]$/.test(linea)) return null
  if (/\.\s+\S/.test(linea.replace(/^\s*\S{1,8}[.)]\s*/, ''))) return null

  const letras = linea.replace(/[^\p{L}]/gu, '')
  if (letras.length >= 4 && letras === letras.toUpperCase()) return 1
  if (new RegExp(`^\\s*${ROMANO}${SEPARADOR}`, 'i').test(linea) && /[A-ZÁÉÍÓÚÑ]/.test(linea)) return 1
  if (new RegExp(`^\\s*\\d{1,2}\\.\\d{1,2}(?:\\.\\d{1,2})?${SEPARADOR}`).test(linea)) return 3
  if (new RegExp(`^\\s*\\d{1,2}${SEPARADOR}`).test(linea)) return 2
  if (new RegExp(`^\\s*[a-zñ]${SEPARADOR}`).test(linea) && palabras <= 8) return 3
  return null
}

/**
 * Arma la cita separando el rótulo del cuerpo. Si el artículo va nombrado al
 * principio ("ARTÍCULO 578 DEL CÓDIGO CIVIL: ..."), ese nombre pasa a ser el
 * rótulo y sale del texto: repetirlo dos veces se ve como un error.
 */
function citar(texto: string): Bloque {
  const limpio = texto.trim()
  const m = ARTICULO.exec(limpio)
  if (!m) return { clase: 'cita', fuente: null, texto: limpio }

  const fuente = m[0].trim().replace(/\s+/g, ' ')
  const resto = limpio.slice(m[0].length)
  // Solo se recorta si lo que sigue es un separador: si no, el nombre del
  // artículo era parte de la frase y sacarlo la dejaría coja.
  const corte = /^\s*(?:[:.\-–—]\s*|\s)["“«]?\s*(?=\p{Lu})/u.exec(resto)
  if (!corte || resto.length - corte[0].length < 40) {
    return { clase: 'cita', fuente, texto: limpio }
  }
  return {
    clase: 'cita',
    fuente,
    texto: resto.slice(corte[0].length).replace(/["”»]\s*$/, '').trim(),
  }
}
