// Qué materia es tuya y cuál todavía no.
//
// Un apunte puede traer todo el semestre. Lo que el curso no ha pasado no
// debería aparecer en las sesiones: preguntar por algo que nunca viste no
// enseña nada y llena el registro de errores de ruido.

import type { Fuente, Item } from '../datos/tipos'
import type { ItemConProgreso } from './cola'
import { normalizar } from './comparar'

export interface Alcance {
  /** Todas las secciones que algún apunte declara. */
  conocidas: Set<string>
  /** Las que el curso ya pasó. */
  enAlcance: Set<string>
  /** Las que además ya tienen su primera pasada. */
  cubiertas: Set<string>
}

export function calcularAlcance(fuentes: Fuente[]): Alcance {
  const conocidas = new Set<string>()
  const enAlcance = new Set<string>()
  const cubiertas = new Set<string>()

  for (const f of fuentes) {
    const secciones = f.secciones ?? []
    const tope = Number.isInteger(f.hasta) ? f.hasta : secciones.length - 1
    secciones.forEach((s, i) => {
      const clave = normalizar(s.titulo)
      if (!clave) return
      conocidas.add(clave)
      if (i <= tope) {
        enAlcance.add(clave)
        if (s.cubierta) cubiertas.add(clave)
      }
    })
  }

  return { conocidas, enAlcance, cubiertas }
}

export type EstadoItem = 'disponible' | 'sinPasada' | 'fueraDeAlcance'

/**
 * Un ítem sin sección, o cuya sección no está en ningún mapa, siempre está
 * disponible: así nada de lo importado a la antigua se pierde.
 */
export function estadoDeItem(item: Item, alcance: Alcance): EstadoItem {
  if (!item.seccion) return 'disponible'
  // El vocabulario es el trabajo previo a leer: no espera a la primera pasada.
  if (item.tipo === 'concepto') {
    const suya = normalizar(item.seccion)
    if (!suya || !alcance.conocidas.has(suya)) return 'disponible'
    return alcance.enAlcance.has(suya) ? 'disponible' : 'fueraDeAlcance'
  }
  const clave = normalizar(item.seccion)
  if (!clave || !alcance.conocidas.has(clave)) return 'disponible'
  if (!alcance.enAlcance.has(clave)) return 'fueraDeAlcance'
  return alcance.cubiertas.has(clave) ? 'disponible' : 'sinPasada'
}

export function filtrarPorAlcance(
  datos: ItemConProgreso[],
  alcance: Alcance,
): { dentro: ItemConProgreso[]; sinPasada: number; fuera: number } {
  const dentro: ItemConProgreso[] = []
  let sinPasada = 0
  let fuera = 0
  for (const d of datos) {
    const estado = estadoDeItem(d.item, alcance)
    if (estado === 'disponible') dentro.push(d)
    else if (estado === 'sinPasada') sinPasada++
    else fuera++
  }
  return { dentro, sinPasada, fuera }
}
