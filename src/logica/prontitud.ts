// El número honesto: si la prueba fuera tal día, ¿cuánto recordarías?
//
// No es "cuántas fichas viste". Usa la curva de olvido de FSRS: cada ítem
// tiene una estabilidad (cuántos días aguanta antes de caer al 90% de
// recuerdo) y de ahí sale la probabilidad de acordarse en una fecha dada.
// R(t,S) = (1 + F·t/(9S))^C, con F = 19/81 y C = -0.5.

import type { Progreso } from '../datos/tipos'
import type { ItemConProgreso } from './cola'
import { desdeISO, hoyISO } from './plan'

const F = 19 / 81
const C = -0.5
const DIA = 24 * 60 * 60 * 1000

/** Probabilidad de acordarse de este ítem en esa fecha, de 0 a 1. */
export function retrievabilidad(p: Progreso, cuando: number): number {
  if (p.totalRepasos === 0) return 0
  // Con Leitner no hay estabilidad: se aproxima con el intervalo de la caja.
  const estabilidad = p.estabilidad > 0 ? p.estabilidad : Math.max(0.5, p.intervaloDias)
  const desde = p.ultimoRepaso ?? cuando
  const dias = Math.max(0, (cuando - desde) / DIA)
  const r = Math.pow(1 + (F * dias) / (9 * estabilidad), C)
  return Math.min(1, Math.max(0, r))
}

export interface Prontitud {
  /** 0 a 100: cuánto del material recordarías ese día. */
  esperado: number
  /** Ítems que nunca has estudiado (cuentan como 0). */
  sinVer: number
  enJuego: number
  /** Los que se van a caer: probabilidad baja el día de la prueba. */
  enPeligro: ItemConProgreso[]
  porBloque: { bloque: string; esperado: number; total: number }[]
}

const PELIGRO = 0.7

export function prontitudEn(
  datos: ItemConProgreso[],
  fechaISO: string,
  bloques: string[] = [],
): Prontitud {
  const cuando = desdeISO(fechaISO).getTime()
  const enJuego = datos.filter(
    (d) => !d.item.suspendido && (bloques.length === 0 || bloques.includes(d.item.bloque)),
  )
  if (enJuego.length === 0) {
    return { esperado: 0, sinVer: 0, enJuego: 0, enPeligro: [], porBloque: [] }
  }

  const porBloque = new Map<string, { suma: number; total: number }>()
  let suma = 0
  let sinVer = 0
  const enPeligro: ItemConProgreso[] = []

  for (const d of enJuego) {
    const r = retrievabilidad(d.progreso, cuando)
    suma += r
    if (d.progreso.totalRepasos === 0) sinVer++
    if (r < PELIGRO) enPeligro.push(d)
    const acumulado = porBloque.get(d.item.bloque) ?? { suma: 0, total: 0 }
    acumulado.suma += r
    acumulado.total++
    porBloque.set(d.item.bloque, acumulado)
  }

  enPeligro.sort(
    (a, b) => retrievabilidad(a.progreso, cuando) - retrievabilidad(b.progreso, cuando),
  )

  return {
    esperado: Math.round((suma / enJuego.length) * 100),
    sinVer,
    enJuego: enJuego.length,
    enPeligro,
    porBloque: [...porBloque.entries()]
      .map(([bloque, x]) => ({ bloque, esperado: Math.round((x.suma / x.total) * 100), total: x.total }))
      .sort((a, b) => a.esperado - b.esperado),
  }
}

export function prontitudHoy(datos: ItemConProgreso[], bloques: string[] = []): Prontitud {
  return prontitudEn(datos, hoyISO(), bloques)
}

// ---------------------------------------------------------------------------
// Calibración: cuando dices "seguro", ¿cuántas veces aciertas de verdad?
// Darse cuenta de esto es lo que baja el exceso de confianza.
// ---------------------------------------------------------------------------

import type { Confianza, Revision } from '../datos/tipos'

export interface FilaCalibracion {
  confianza: Confianza
  intentos: number
  aciertos: number
  /** 0 a 100. */
  razon: number
}

export interface Calibracion {
  filas: FilaCalibracion[]
  intentos: number
  /** Diferencia entre lo que creías saber y lo que sabías, en puntos. */
  exceso: number
}

const VALOR: Record<Confianza, number> = { seguro: 1, masOMenos: 0.5, adivinando: 0.15 }

export function calibracion(revisiones: Revision[]): Calibracion {
  const orden: Confianza[] = ['seguro', 'masOMenos', 'adivinando']
  const filas = orden.map((confianza) => {
    const propias = revisiones.filter((r) => r.confianza === confianza)
    const aciertos = propias.filter((r) => r.nota === 'laTenia').length
    return {
      confianza,
      intentos: propias.length,
      aciertos,
      razon: propias.length === 0 ? 0 : Math.round((aciertos / propias.length) * 100),
    }
  })

  const intentos = revisiones.length
  let exceso = 0
  if (intentos > 0) {
    const creido = revisiones.reduce((suma, r) => suma + VALOR[r.confianza], 0) / intentos
    const real = revisiones.filter((r) => r.nota === 'laTenia').length / intentos
    exceso = Math.round((creido - real) * 100)
  }

  return { filas, intentos, exceso }
}
