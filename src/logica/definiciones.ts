// Buscar la definición de un término dentro del propio apunte.
//
// Muchas veces el apunte sí define la palabra y no hace falta preguntarle a
// nadie. Cuando no la define —porque el profesor la dio por sabida— hay que
// ir a buscarla afuera, y eso lo dice esta función devolviendo null.

import { contiene } from './comparar'

/** Fórmulas con que un texto jurídico define algo. */
const FORMULAS = [
  'se entiende por', 'se denomina', 'se define', 'se llama', 'consiste en',
  'es aquel', 'es aquella', 'es la', 'es el', 'son los', 'son las',
  'puede definirse', 'se conoce como', 'corresponde a', 'no es otra cosa',
]

export interface Hallazgo {
  /** La frase que define el término, si el apunte lo define. */
  definicion: string | null
  /** La frase donde aparece, sirva o no de definición. */
  contexto: string | null
}

function frases(texto: string): string[] {
  return texto
    .replace(/\s+/g, ' ')
    // No cortar en "art." ni en números con punto.
    .replace(/\b(art|arts|inc|n|nro|sr|sra|pág|pag)\.\s/gi, '$1<punto> ')
    .split(/(?<=[.;:!?])\s+/)
    .map((f) => f.replace(/<punto>/g, '.').trim())
    .filter((f) => f.length > 25)
}

export function buscarDefinicion(texto: string, termino: string): Hallazgo {
  const candidatas = frases(texto).filter((f) => contiene(f, termino))
  if (candidatas.length === 0) return { definicion: null, contexto: null }

  const contexto = candidatas[0]

  // Una definición de verdad: el término y una fórmula definitoria cerca.
  const definitoria = candidatas.find((f) => {
    const minusculas = f.toLowerCase()
    return FORMULAS.some((formula) => minusculas.includes(formula))
  })

  return { definicion: definitoria ?? null, contexto }
}

/** Todas las frases del apunte donde aparece el término, para dar contexto. */
export function aparicionesDe(texto: string, termino: string, tope = 3): string[] {
  return frases(texto).filter((f) => contiene(f, termino)).slice(0, tope)
}
