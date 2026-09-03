import type { Item } from '../datos/tipos'

/**
 * Modo cadena: después de responder el padre, vienen sus repreguntas una
 * tras otra. Nunca se anuncia cuántas son.
 */
export function hijosDe(items: Item[], padreId: string): Item[] {
  return items
    .filter((i) => i.padreId === padreId && !i.suspendido)
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.creadoEn - b.creadoEn)
}

export function tieneHijos(items: Item[], padreId: string): boolean {
  return items.some((i) => i.padreId === padreId && !i.suspendido)
}

/** Cadena completa en profundidad: una repregunta también puede tener hijas. */
export function cadenaCompleta(items: Item[], padreId: string): Item[] {
  const salida: Item[] = []
  const visitados = new Set<string>()
  const recorrer = (id: string) => {
    for (const hijo of hijosDe(items, id)) {
      if (visitados.has(hijo.id)) continue
      visitados.add(hijo.id)
      salida.push(hijo)
      recorrer(hijo.id)
    }
  }
  recorrer(padreId)
  return salida
}
