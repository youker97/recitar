// Cuánto tienes agarrada cada materia. No es "cuántas tarjetas viste": es
// cuánto aguanta cada ítem antes de que se te olvide.

import type { Progreso } from '../datos/tipos'
import type { ItemConProgreso } from './cola'

/** 0 a 1. Un ítem recién visto no vale lo mismo que uno que aguanta un mes. */
export function nivelDeDominio(p: Progreso): number {
  if (p.totalRepasos === 0) return 0
  if (p.enErrores) return 0.15
  if (p.intervaloDias >= 21 || p.caja >= 5) return 1
  if (p.intervaloDias >= 7 || p.caja >= 4) return 0.8
  if (p.intervaloDias >= 3 || p.caja >= 3) return 0.55
  return 0.3
}

export interface Dominio {
  bloque: string
  total: number
  dominados: number
  enErrores: number
  sinVer: number
  /** 0 a 100. */
  porcentaje: number
}

export function dominioDe(datos: ItemConProgreso[], bloque = ''): Dominio {
  const total = datos.length
  if (total === 0) {
    return { bloque, total: 0, dominados: 0, enErrores: 0, sinVer: 0, porcentaje: 0 }
  }
  let suma = 0
  let dominados = 0
  let enErrores = 0
  let sinVer = 0
  for (const { progreso } of datos) {
    const nivel = nivelDeDominio(progreso)
    suma += nivel
    if (nivel >= 0.8) dominados++
    if (progreso.enErrores) enErrores++
    if (progreso.totalRepasos === 0) sinVer++
  }
  return {
    bloque,
    total,
    dominados,
    enErrores,
    sinVer,
    porcentaje: Math.round((suma / total) * 100),
  }
}

export function dominioPorBloque(datos: ItemConProgreso[]): Dominio[] {
  const mapa = new Map<string, ItemConProgreso[]>()
  for (const d of datos) {
    if (d.item.suspendido) continue
    const lista = mapa.get(d.item.bloque) ?? []
    lista.push(d)
    mapa.set(d.item.bloque, lista)
  }
  return [...mapa.entries()]
    .map(([bloque, lista]) => dominioDe(lista, bloque))
    .sort((a, b) => a.porcentaje - b.porcentaje || a.bloque.localeCompare(b.bloque, 'es'))
}

export function dominioGeneral(datos: ItemConProgreso[]): Dominio {
  return dominioDe(datos.filter((d) => !d.item.suspendido), 'todo')
}
