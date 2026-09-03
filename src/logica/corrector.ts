// Corrección automática de respuestas escritas, sin internet.
//
// No entiende lo que escribiste: busca en tu texto los términos que la pauta
// exige. En Derecho eso alcanza harto, porque la pauta está amarrada a la
// terminología: si no dijiste "condición resolutoria tácita", en la prueba
// tampoco te lo habrían dado por dicho.
//
// Encima de esto está la corrección con Claude (semántica) y, al final, tu
// propia mano. Los tres niveles conviven.

import { contiene } from './comparar'
import type { DatosVF, PuntoPauta } from '../datos/tipos'

/** Acepta la pauta antigua (textos pelados) y la nueva (con claves). */
export function puntosDe(checklist: (string | PuntoPauta)[]): PuntoPauta[] {
  return checklist.map((p) => (typeof p === 'string' ? { texto: p } : p))
}

const RELLENO = new Set([
  'menciona', 'cita', 'nombra', 'explica', 'señala', 'indica', 'distingue',
  'define', 'desarrolla', 'punto', 'debe', 'tiene', 'hace', 'dice', 'todo',
  'toda', 'todos', 'todas', 'cuando', 'donde', 'porque', 'entonces', 'tambien',
  'ademas', 'salvo', 'segun', 'sino', 'aunque', 'mismo', 'misma', 'otro', 'otra',
  'menos', 'mas', 'muy', 'solo', 'tanto', 'cada', 'ello', 'esto', 'eso',
])

/** Formas verbales que no son el concepto, aunque sean largas. */
const TERMINACIONES = ['ando', 'iendo', 'arla', 'arlo', 'arle', 'arse', 'aron', 'aban', 'aria', 'arian']

function esPalabraDeContenido(normalizada: string): boolean {
  if (!normalizada) return false
  if (/^\d{2,}$/.test(normalizada)) return true
  if (normalizada.length < 4) return false
  if (VACIAS_LOCALES.has(normalizada) || RELLENO.has(normalizada)) return false
  return !TERMINACIONES.some((t) => normalizada.endsWith(t))
}

// Las mismas palabras vacías que usa la comparación, más las de relleno.
const VACIAS_LOCALES = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al',
  'a', 'ante', 'con', 'en', 'para', 'por', 'sin', 'sobre', 'tras', 'y', 'e',
  'o', 'u', 'que', 'se', 'su', 'sus', 'lo', 'le', 'les', 'es', 'son', 'ser',
  'sea', 'sean', 'esta', 'este', 'estos', 'estas', 'ha', 'han', 'hay',
  'tener', 'tenga', 'tengan', 'tiene', 'tienen', 'puede', 'pueden', 'deben',
])

interface Ficha {
  texto: string
  normalizada: string
  inicio: number
  fin: number
  /** Posición entre todas las palabras del texto. */
  orden: number
}

function fichar(texto: string): Ficha[] {
  const salida: Ficha[] = []
  const patron = /[\p{L}\p{N}]+/gu
  let coincidencia: RegExpExecArray | null
  let orden = 0
  while ((coincidencia = patron.exec(texto)) !== null) {
    salida.push({
      texto: coincidencia[0],
      normalizada: coincidencia[0].normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(),
      inicio: coincidencia.index,
      fin: coincidencia.index + coincidencia[0].length,
      orden: orden++,
    })
  }
  return salida
}

/**
 * Si la pauta no trae claves, se deducen del propio punto. Se prefieren
 * frases de dos palabras ("culpa grave", "ministerio público") antes que
 * palabras sueltas, porque una palabra suelta no es un concepto. Los números
 * de artículo siempre entran.
 */
export function clavesDe(punto: PuntoPauta, cuantas = 3): string[] {
  if (punto.claves?.length) return punto.claves

  const fichas = fichar(punto.texto)
  const contenido = fichas.filter((f) => esPalabraDeContenido(f.normalizada))
  if (contenido.length === 0) return []

  const numeros = contenido.filter((f) => /^\d{2,}$/.test(f.normalizada))
  const palabras = contenido.filter((f) => !/^\d+$/.test(f.normalizada))

  // Frases: dos palabras de contenido separadas por a lo más una palabra vacía.
  const frases: { texto: string; peso: number; usa: number[] }[] = []
  for (let i = 0; i + 1 < palabras.length; i++) {
    const a = palabras[i]
    const b = palabras[i + 1]
    if (b.orden - a.orden > 2) continue
    // Una frase no cruza puntuación: "prueba: incumbe" no es un concepto.
    const entre = punto.texto.slice(a.fin, b.inicio)
    if (!/^[\p{L}\s]*$/u.test(entre)) continue
    frases.push({
      texto: punto.texto.slice(a.inicio, b.fin),
      peso: a.texto.length + b.texto.length,
      usa: [a.orden, b.orden],
    })
  }
  frases.sort((x, y) => y.peso - x.peso || x.usa[0] - y.usa[0])

  const ocupadas = new Set<number>()
  const elegidas: string[] = []
  for (const f of frases) {
    if (f.usa.some((o) => ocupadas.has(o))) continue
    f.usa.forEach((o) => ocupadas.add(o))
    elegidas.push(f.texto)
    if (elegidas.length >= cuantas) break
  }

  for (const n of numeros) {
    if (elegidas.length >= cuantas + numeros.length) break
    if (!elegidas.some((e) => e.includes(n.texto))) elegidas.push(n.texto)
  }

  if (elegidas.length === 0) {
    const sueltas = palabras
      .filter((f) => !ocupadas.has(f.orden))
      .sort((a, b) => b.texto.length - a.texto.length)
      .slice(0, cuantas)
      .map((f) => f.texto)
    return sueltas.length > 0 ? sueltas : [contenido[0].texto]
  }

  return elegidas.slice(0, cuantas + numeros.length)
}

export interface PuntoRevisado {
  indice: number
  texto: string
  claves: string[]
  encontradas: string[]
  faltantes: string[]
  /** 0 a 1: qué proporción de las claves aparece. */
  puntaje: number
  encontrado: boolean
}

export interface Revision {
  puntos: PuntoRevisado[]
  encontrados: number
  total: number
  /** true si la app tuvo texto que revisar (en papel o en oral, no lo hay). */
  automatica: boolean
}

/** Un punto se da por dicho si aparece la mayoría de sus claves. */
const MINIMO_CLAVES = 0.6

export function revisarRespuesta(respuesta: string, puntos: PuntoPauta[]): Revision {
  const limpia = respuesta.trim()
  const revisados = puntos.map((punto, indice) => {
    const claves = clavesDe(punto)
    const encontradas = claves.filter((c) => contiene(limpia, c))
    const puntaje = claves.length === 0 ? 0 : encontradas.length / claves.length
    return {
      indice,
      texto: punto.texto,
      claves,
      encontradas,
      faltantes: claves.filter((c) => !encontradas.includes(c)),
      puntaje,
      encontrado: puntaje >= MINIMO_CLAVES && encontradas.length > 0,
    }
  })

  return {
    puntos: revisados,
    encontrados: revisados.filter((p) => p.encontrado).length,
    total: revisados.length,
    automatica: limpia.length > 0,
  }
}

/**
 * Para verdadero/falso: revisa la justificación escrita contra las ideas de la
 * justificación correcta. Si el ítem no trae claves, se deducen de ella.
 */
export function revisarJustificacion(escrita: string, datos: DatosVF): Revision {
  const claves = datos.claves?.length
    ? datos.claves
    : clavesDe({ texto: datos.justificacion }, 4)
  return revisarRespuesta(escrita, claves.map((c) => ({ texto: c, claves: [c] })))
}

/** Cuenta palabras de verdad, para el contador de extensión. */
export function contarPalabras(texto: string): number {
  return texto.trim().split(/\s+/).filter(Boolean).length
}
