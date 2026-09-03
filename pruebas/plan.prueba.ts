import { describe, expect, it } from 'vitest'
import { cargaDeHoy, diasHasta, estaDominado, estadoDeEvaluacion, hoyISO } from '../src/logica/plan'
import { progresoNuevo } from '../src/logica/programador'
import type { ItemConProgreso } from '../src/logica/cola'
import type { Evaluacion, Item } from '../src/datos/tipos'

const HOY = new Date(2026, 8, 3)

function item(id: string, bloque: string): Item {
  return {
    id, cursoId: 'c', bloque, tipo: 'vf',
    datos: { pregunta: id, esVerdadera: true, justificacion: 'j' },
    ref: '', origen: 'manual', creadoEn: 0, actualizadoEn: 0,
  }
}

function dato(id: string, bloque: string, cambios: Partial<ItemConProgreso['progreso']> = {}): ItemConProgreso {
  const i = item(id, bloque)
  return { item: i, progreso: { ...progresoNuevo(i, HOY.getTime()), ...cambios } }
}

const prueba: Evaluacion = {
  id: 'e1', cursoId: 'c', nombre: 'Solemne 2', fecha: '2026-09-13',
  bloques: ['Obligaciones'], tipo: 'escrita',
}

describe('plan por fecha de prueba', () => {
  it('cuenta los días que faltan', () => {
    expect(diasHasta('2026-09-13', HOY)).toBe(10)
    expect(diasHasta(hoyISO(HOY), HOY)).toBe(0)
  })

  it('dominado significa que aguanta al menos una semana y no está en errores', () => {
    expect(estaDominado(dato('a', 'A', { totalRepasos: 3, intervaloDias: 16 }).progreso)).toBe(true)
    expect(estaDominado(dato('b', 'A', { totalRepasos: 3, intervaloDias: 16, enErrores: true }).progreso)).toBe(false)
    expect(estaDominado(dato('c', 'A').progreso)).toBe(false)
  })

  it('solo cuenta los bloques que entran en esa prueba', () => {
    const datos = [
      dato('1', 'Obligaciones'),
      dato('2', 'Obligaciones', { totalRepasos: 4, intervaloDias: 20 }),
      dato('3', 'Procesal'),
    ]
    const estado = estadoDeEvaluacion(prueba, datos, HOY)
    expect(estado.enJuego).toBe(2)
    expect(estado.dominados).toBe(1)
    expect(estado.pendientes).toBe(1)
  })

  it('reparte la carga en vez de dejarla para el final', () => {
    const datos = Array.from({ length: 40 }, (_, i) => dato(String(i), 'Obligaciones'))
    const estado = estadoDeEvaluacion(prueba, datos, HOY)
    expect(estado.porDia).toBe(4)
    expect(estado.apretado).toBe(false)
  })

  it('avisa cuando la carga diaria ya no da', () => {
    const datos = Array.from({ length: 400 }, (_, i) => dato(String(i), 'Obligaciones'))
    expect(estadoDeEvaluacion(prueba, datos, HOY).apretado).toBe(true)
  })

  it('deja fuera las pruebas que ya pasaron', () => {
    const vieja: Evaluacion = { ...prueba, id: 'e0', fecha: '2026-08-01' }
    const { estados } = cargaDeHoy([vieja, prueba], [dato('1', 'Obligaciones')], HOY)
    expect(estados.map((e) => e.evaluacion.id)).toEqual(['e1'])
  })
})
