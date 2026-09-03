import { describe, expect, it } from 'vitest'
import { calcularRacha } from '../src/logica/racha'
import type { Revision } from '../src/datos/tipos'

const HOY = new Date(2026, 8, 3, 20, 0, 0)
const DIA = 24 * 60 * 60 * 1000

function revisiones(diasAtras: number[], porDia = 5): Revision[] {
  const salida: Revision[] = []
  for (const d of diasAtras) {
    for (let k = 0; k < porDia; k++) {
      salida.push({
        itemId: 'i', cursoId: 'c', bloque: 'A', tipo: 'vf',
        fecha: HOY.getTime() - d * DIA, modo: 'vf', confianza: 'seguro',
        nota: 'laTenia', grave: false, duracionMs: 0,
      })
    }
  }
  return salida
}

describe('racha', () => {
  it('cuenta los días seguidos que cumplieron la meta', () => {
    const r = calcularRacha(revisiones([0, 1, 2, 3]), 5, 14, HOY)
    expect(r.actual).toBe(4)
    expect(r.hoyCumplido).toBe(true)
    expect(r.enRiesgo).toBe(false)
  })

  it('un día con menos de la meta corta la racha', () => {
    const pocas = revisiones([2], 2)
    const r = calcularRacha([...revisiones([0, 1]), ...pocas], 5, 14, HOY)
    expect(r.actual).toBe(2)
  })

  it('si hoy todavía no cumples, la racha sigue viva pero en riesgo', () => {
    const r = calcularRacha([...revisiones([1, 2, 3]), ...revisiones([0], 2)], 5, 14, HOY)
    expect(r.actual).toBe(3)
    expect(r.hoyCumplido).toBe(false)
    expect(r.enRiesgo).toBe(true)
    expect(r.respuestasHoy).toBe(2)
  })

  it('guarda el récord aunque la racha actual se haya cortado', () => {
    const r = calcularRacha(revisiones([5, 6, 7, 8, 9]), 5, 20, HOY)
    expect(r.actual).toBe(0)
    expect(r.record).toBe(5)
    expect(r.enRiesgo).toBe(false)
  })

  it('sin historial, no hay racha', () => {
    const r = calcularRacha([], 5, 7, HOY)
    expect(r.actual).toBe(0)
    expect(r.record).toBe(0)
    expect(r.dias).toHaveLength(7)
  })
})
