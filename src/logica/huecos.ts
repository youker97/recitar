// Texto legal con huecos: se ocultan palabras que importan y cambian entre
// repasos, para no memorizar la forma del hueco sino el texto.

const VACIAS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al',
  'a', 'ante', 'con', 'en', 'para', 'por', 'sin', 'sobre', 'tras', 'y', 'e',
  'o', 'u', 'que', 'se', 'su', 'sus', 'lo', 'le', 'les', 'es', 'son', 'ser',
  'como', 'mas', 'pero', 'si', 'no', 'ni', 'esta', 'este', 'estos', 'estas',
])

export interface Trozo {
  texto: string
  /** true = es palabra (candidata a hueco); false = espacio o puntuación. */
  esPalabra: boolean
  /** Índice entre las palabras (solo si esPalabra). */
  indicePalabra?: number
  /** Si viene marcada con {{ }} en el original. */
  forzada?: boolean
}

const MARCA = /\{\{([^}]+)\}\}/g

export function trocear(texto: string): Trozo[] {
  const forzadas = new Set<number>()
  let plano = texto
  const posicionesForzadas: string[] = []
  plano = plano.replace(MARCA, (_, dentro: string) => {
    posicionesForzadas.push(dentro.trim())
    return dentro.trim()
  })

  const trozos: Trozo[] = []
  let indicePalabra = 0
  const partes = plano.split(/(\s+|[^\p{L}\p{N}\s'-]+)/u)
  for (const parte of partes) {
    if (!parte) continue
    const esPalabra = /[\p{L}\p{N}]/u.test(parte) && !/^\s+$/.test(parte)
    if (esPalabra) {
      trozos.push({ texto: parte, esPalabra: true, indicePalabra })
      indicePalabra++
    } else {
      trozos.push({ texto: parte, esPalabra: false })
    }
  }

  // Marcar como forzadas las palabras que venían entre llaves.
  for (const forzada of posicionesForzadas) {
    const objetivo = trozos.find((t) => t.esPalabra && t.texto === forzada && !t.forzada)
    if (objetivo) {
      objetivo.forzada = true
      forzadas.add(objetivo.indicePalabra!)
    }
  }
  return trozos
}

function normalizar(p: string): string {
  return p.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '')
}

function azarConSemilla(semilla: number): () => number {
  let s = semilla >>> 0 || 1
  return () => {
    s ^= s << 13; s >>>= 0
    s ^= s >> 17
    s ^= s << 5; s >>>= 0
    return s / 4294967296
  }
}

export function semillaDesde(texto: string, vuelta: number): number {
  let h = 2166136261
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h ^ Math.imul(vuelta + 1, 2654435761)) >>> 0
}

export interface TextoConHuecos {
  trozos: Trozo[]
  /** Índices de palabra que quedan ocultos. */
  huecos: number[]
  /** Palabra correcta de cada hueco, en el mismo orden. */
  respuestas: string[]
}

export function prepararHuecos(
  textoLiteral: string,
  vuelta = 0,
  proporcion = 0.22,
): TextoConHuecos {
  const trozos = trocear(textoLiteral)
  const palabras = trozos.filter((t) => t.esPalabra)
  const forzadas = palabras.filter((t) => t.forzada).map((t) => t.indicePalabra!)

  let huecos: number[]
  if (forzadas.length > 0) {
    huecos = [...forzadas]
  } else {
    const candidatas = palabras.filter((t) => {
      const n = normalizar(t.texto)
      if (!n) return false
      if (/^\d+$/.test(n)) return true
      return n.length >= 4 && !VACIAS.has(n)
    })
    const cuantos = Math.max(3, Math.min(12, Math.round(palabras.length * proporcion)))
    const azar = azarConSemilla(semillaDesde(textoLiteral, vuelta))
    const mezcladas = [...candidatas]
    for (let i = mezcladas.length - 1; i > 0; i--) {
      const j = Math.floor(azar() * (i + 1))
      const t = mezcladas[i]; mezcladas[i] = mezcladas[j]; mezcladas[j] = t
    }
    // Evita dos huecos pegados: se vuelve ilegible.
    const elegidos: number[] = []
    for (const c of mezcladas) {
      const idx = c.indicePalabra!
      if (elegidos.some((e) => Math.abs(e - idx) < 2)) continue
      elegidos.push(idx)
      if (elegidos.length >= cuantos) break
    }
    huecos = elegidos
  }

  huecos.sort((a, b) => a - b)
  const respuestas = huecos.map(
    (i) => palabras.find((p) => p.indicePalabra === i)?.texto ?? '',
  )
  return { trozos, huecos, respuestas }
}

export function aciertaHueco(respuesta: string, correcta: string): boolean {
  return normalizar(respuesta) === normalizar(correcta)
}
