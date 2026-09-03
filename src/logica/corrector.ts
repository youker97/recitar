// Corrección automática de respuestas escritas, sin internet.
//
// No entiende lo que escribiste: busca en tu texto los términos que la pauta
// exige. En Derecho eso alcanza harto, porque la pauta está amarrada a la
// terminología: si no dijiste "condición resolutoria tácita", en la prueba
// tampoco te lo habrían dado por dicho.
//
// Encima de esto está la corrección con Claude (semántica) y, al final, tu
// propia mano. Los tres niveles conviven.

import { contiene, fichas } from './comparar'
import type { DatosVF, PuntoPauta } from '../datos/tipos'

/** Acepta la pauta antigua (textos pelados) y la nueva (con claves). */
export function puntosDe(checklist: (string | PuntoPauta)[]): PuntoPauta[] {
  return checklist.map((p) => (typeof p === 'string' ? { texto: p } : p))
}

const RELLENO = new Set([
  'menciona', 'cita', 'nombra', 'explica', 'señala', 'indica', 'distingue',
  'define', 'desarrolla', 'punto', 'debe', 'tiene', 'hace', 'dice',
])

/**
 * Si la pauta no trae claves, se deducen del propio punto: las palabras con
 * más contenido, más los números (que casi siempre son artículos).
 */
export function clavesDe(punto: PuntoPauta, cuantas = 3): string[] {
  if (punto.claves?.length) return punto.claves
  const palabras = fichas(punto.texto).filter((p) => !RELLENO.has(p))
  const numeros = palabras.filter((p) => /^\d{2,}$/.test(p))
  const largas = palabras
    .filter((p) => p.length >= 5 && !/^\d+$/.test(p))
    .sort((a, b) => b.length - a.length)
  const elegidas = [...new Set([...numeros, ...largas])].slice(0, cuantas)
  return elegidas.length > 0 ? elegidas : palabras.slice(0, 1)
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
