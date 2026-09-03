// Comparación tolerante: acepta tildes, mayúsculas, puntuación, artículos
// y pequeñas diferencias de tipeo. No acepta contenido distinto.

// Palabras que no aportan contenido: artículos, preposiciones y los verbos
// de relleno con que se arman las enumeraciones legales ("que sea", "que tenga").
const VACIAS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al',
  'a', 'ante', 'con', 'en', 'para', 'por', 'segun', 'sin', 'sobre', 'tras',
  'y', 'e', 'o', 'u', 'que', 'se', 'su', 'sus', 'lo', 'le', 'les',
  'es', 'son', 'ser', 'sea', 'sean', 'seas', 'era', 'eran', 'fue', 'fueron',
  'esta', 'estan', 'este', 'estos', 'estas', 'estar',
  'ha', 'han', 'haber', 'hay', 'habia',
  'tener', 'tenga', 'tengan', 'tiene', 'tienen',
  'debe', 'deben', 'deber', 'puede', 'pueden',
])

export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^\s*(\d+[.)-]|[a-z][.)]|[-*•])\s*/, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function fichas(texto: string): string[] {
  return normalizar(texto)
    .split(' ')
    .filter((p) => p.length > 0 && !VACIAS.has(p))
    // Los adverbios en -mente casi nunca son el contenido ("legalmente capaz").
    .filter((p) => !(p.length > 6 && p.endsWith('mente')))
}

function distancia(a: string, b: string): number {
  if (a === b) return 0
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  let previa = new Array<number>(n + 1)
  let actual = new Array<number>(n + 1)
  for (let j = 0; j <= n; j++) previa[j] = j
  for (let i = 1; i <= m; i++) {
    actual[0] = i
    for (let j = 1; j <= n; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1
      actual[j] = Math.min(actual[j - 1] + 1, previa[j] + 1, previa[j - 1] + costo)
    }
    const t = previa; previa = actual; actual = t
  }
  return previa[n]
}

/**
 * 0 a 1, midiendo cuánto de lo ESPERADO está en la respuesta. Escribir de más
 * penaliza poco (para no castigar el relleno), pero una respuesta larguísima
 * no puede calzar con todo: para eso está el factor de exceso.
 */
export function similitud(respuesta: string, esperado: string): number {
  const na = normalizar(respuesta)
  const nb = normalizar(esperado)
  if (!na || !nb) return 0
  if (na === nb) return 1

  const porLetras = 1 - distancia(na, nb) / Math.max(na.length, nb.length)

  const fa = fichas(respuesta)
  const fb = fichas(esperado)
  if (fa.length === 0 || fb.length === 0) return porLetras

  let cubiertas = 0
  for (const pb of fb) {
    let mejor = 0
    for (const pa of fa) {
      if (pa === pb) { mejor = 1; break }
      const d = distancia(pa, pb)
      const largo = Math.max(pa.length, pb.length)
      const s = 1 - d / largo
      if (s > mejor) mejor = s
    }
    if (mejor >= 0.75) cubiertas += mejor
  }
  const cobertura = cubiertas / fb.length
  const exceso = Math.min(1, (fb.length + 3) / (fa.length + 3))

  return Math.max(cobertura * exceso, porLetras * 0.9)
}

export const UMBRAL = 0.72

export function coincide(a: string, b: string, umbral = UMBRAL): boolean {
  return similitud(a, b) >= umbral
}

export interface ParejaLista {
  indiceEsperado: number
  indiceRespuesta: number
  puntaje: number
}

export interface ResultadoLista {
  aciertos: number
  total: number
  parejas: ParejaLista[]
  faltantes: number[]
  sobrantes: number[]
  /** Solo si el orden importaba. */
  ordenCorrecto?: boolean
}

/** Empareja lo que escribí con lo que debía decir, sin exigir el orden. */
export function compararLista(
  respuestas: string[],
  esperados: string[],
  ordenImporta = false,
  umbral = UMBRAL,
): ResultadoLista {
  const limpias = respuestas.map((r) => r.trim()).filter((r) => r.length > 0)
  const candidatas: ParejaLista[] = []
  esperados.forEach((esperado, i) => {
    limpias.forEach((respuesta, j) => {
      const puntaje = similitud(respuesta, esperado)
      if (puntaje >= umbral) candidatas.push({ indiceEsperado: i, indiceRespuesta: j, puntaje })
    })
  })
  candidatas.sort((a, b) => b.puntaje - a.puntaje)

  const usadosEsperados = new Set<number>()
  const usadasRespuestas = new Set<number>()
  const parejas: ParejaLista[] = []
  for (const c of candidatas) {
    if (usadosEsperados.has(c.indiceEsperado) || usadasRespuestas.has(c.indiceRespuesta)) continue
    usadosEsperados.add(c.indiceEsperado)
    usadasRespuestas.add(c.indiceRespuesta)
    parejas.push(c)
  }
  parejas.sort((a, b) => a.indiceEsperado - b.indiceEsperado)

  const faltantes = esperados.map((_, i) => i).filter((i) => !usadosEsperados.has(i))
  const sobrantes = limpias.map((_, j) => j).filter((j) => !usadasRespuestas.has(j))

  let ordenCorrecto: boolean | undefined
  if (ordenImporta) {
    ordenCorrecto = parejas.every((p, k) => k === 0 || p.indiceRespuesta > parejas[k - 1].indiceRespuesta)
  }

  return { aciertos: parejas.length, total: esperados.length, parejas, faltantes, sobrantes, ordenCorrecto }
}

/** Para números de artículo: "art. 1489" y "1489" son lo mismo. */
export function normalizarNumeroArticulo(texto: string): string {
  return texto
    .toLowerCase()
    .replace(/art[íi]culos?|arts?\.?|n[°º]|nro\.?|inc(iso)?\.?/g, ' ')
    .replace(/[^\p{L}\p{N}]/gu, '')
    .trim()
}

export function coincideArticulo(a: string, b: string): boolean {
  const na = normalizarNumeroArticulo(a)
  const nb = normalizarNumeroArticulo(b)
  return na.length > 0 && na === nb
}
