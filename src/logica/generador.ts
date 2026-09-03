// Preguntas de alternativas armadas por la app, sin internet, a partir del
// material que ya tienes. Los distractores no se inventan: son contenido real
// del mismo bloque, que es lo que los hace difíciles.

import type { DatosArticulo, DatosLista, DatosRepregunta, Item } from '../datos/tipos'
import { normalizar } from './comparar'

function azar(semilla: number): () => number {
  let s = semilla >>> 0 || 1
  return () => {
    s ^= s << 13; s >>>= 0
    s ^= s >> 17
    s ^= s << 5; s >>>= 0
    return s / 4294967296
  }
}

function tomar<T>(lista: T[], cuantos: number, dado: () => number): T[] {
  const copia = [...lista]
  const salida: T[] = []
  while (salida.length < cuantos && copia.length > 0) {
    salida.push(copia.splice(Math.floor(dado() * copia.length), 1)[0])
  }
  return salida
}

export function semillaDe(id: string, vuelta = 0): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h ^ Math.imul(vuelta + 1, 2654435761)) >>> 0
}

/**
 * Convierte un ítem en una pregunta de alternativas usando otros ítems del
 * mismo bloque como distractores. Devuelve null si no hay con qué armarla.
 */
export function generarAlternativas(base: Item, pool: Item[], vuelta = 0): Item | null {
  const dado = azar(semillaDe(base.id, vuelta))
  const mismos = pool.filter((i) => i.id !== base.id && i.bloque === base.bloque)
  const cualquiera = pool.filter((i) => i.id !== base.id)
  const vecinos = mismos.length >= 3 ? mismos : cualquiera

  const armar = (pregunta: string, correcta: string, distractores: string[], explicacion: string) => {
    const limpios = [...new Set(distractores.map((d) => d.trim()).filter(Boolean))]
      .filter((d) => normalizar(d) !== normalizar(correcta))
      .slice(0, 3)
    if (limpios.length < 2) return null
    const opciones = [correcta, ...limpios]
    return {
      ...base,
      tipo: 'alternativas' as const,
      datos: { pregunta, opciones, correcta: 0, explicacion },
    }
  }

  if (base.tipo === 'articulo') {
    const d = base.datos as DatosArticulo
    const otros = vecinos.filter((i) => i.tipo === 'articulo')
    const distractores = tomar(otros, 3, dado).map((i) => (i.datos as DatosArticulo).materia)
    return armar(
      `¿De qué trata el artículo ${d.numero}${d.cuerpo ? ` del ${d.cuerpo}` : ''}?`,
      d.materia,
      distractores,
      `El artículo ${d.numero} trata de: ${d.materia}.`,
    )
  }

  if (base.tipo === 'repregunta') {
    const d = base.datos as DatosRepregunta
    const otros = vecinos.filter((i) => i.tipo === 'repregunta')
    const distractores = tomar(otros, 3, dado).map((i) => (i.datos as DatosRepregunta).respuesta)
    return armar(d.pregunta, d.respuesta, distractores, d.respuesta)
  }

  if (base.tipo === 'lista') {
    const d = base.datos as DatosLista
    if (d.elementos.length < 3) return null
    const ajenas = vecinos
      .filter((i) => i.tipo === 'lista')
      .flatMap((i) => (i.datos as DatosLista).elementos)
      .filter((e) => !d.elementos.some((p) => normalizar(p) === normalizar(e)))
    const intrusa = tomar(ajenas, 1, dado)[0]
    if (!intrusa) return null
    const verdaderas = tomar(d.elementos, 3, dado)
    // Acá la "correcta" es la que NO pertenece.
    const opciones = [intrusa, ...verdaderas]
    return {
      ...base,
      tipo: 'alternativas' as const,
      datos: {
        pregunta: `¿Cuál de estas NO corresponde a: ${d.titulo}?`,
        opciones,
        correcta: 0,
        explicacion: `“${intrusa}” no es parte de ${d.titulo}. Las otras tres sí.`,
      },
    }
  }

  return null
}

/** Cuáles de estos ítems se pueden transformar en alternativas. */
export function puedeGenerarse(item: Item): boolean {
  return item.tipo === 'articulo' || item.tipo === 'repregunta' || item.tipo === 'lista'
}
