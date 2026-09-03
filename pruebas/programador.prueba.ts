import { describe, expect, it } from 'vitest'
import { ACIERTOS_PARA_SALIR, aplicarRevision, progresoNuevo } from '../src/logica/programador'
import type { Item, Progreso } from '../src/datos/tipos'

const item: Item = {
  id: 'x', cursoId: 'c', bloque: 'Obligaciones', tipo: 'vf',
  datos: { pregunta: 'p', esVerdadera: true, justificacion: 'j' },
  ref: 'art. 1', origen: 'manual', creadoEn: 0, actualizadoEn: 0,
}

const AHORA = 1_700_000_000_000
const DIA = 24 * 60 * 60 * 1000

function acertarVeces(p: Progreso, veces: number, motor: 'fsrs' | 'leitner' = 'fsrs'): Progreso {
  let actual = p
  for (let i = 0; i < veces; i++) {
    actual = aplicarRevision(actual, { nota: 'laTenia', grave: false }, motor, AHORA + i * DIA)
  }
  return actual
}

describe('programador', () => {
  it('un ítem nuevo empieza vencido y sin historial', () => {
    const p = progresoNuevo(item, AHORA)
    expect(p.vence).toBe(AHORA)
    expect(p.totalRepasos).toBe(0)
    expect(p.enErrores).toBe(false)
  })

  it('fallar mete el ítem al registro de errores', () => {
    const p = aplicarRevision(progresoNuevo(item, AHORA), { nota: 'meFalto', grave: false }, 'fsrs', AHORA)
    expect(p.enErrores).toBe(true)
    expect(p.totalFallos).toBe(1)
    expect(p.aciertosSeguidos).toBe(0)
  })

  it('el error grave se cuenta aparte y vuelve dentro de la sesión', () => {
    const p = aplicarRevision(progresoNuevo(item, AHORA), { nota: 'meFalto', grave: true }, 'fsrs', AHORA)
    expect(p.fallosGraves).toBe(1)
    expect(p.urgente).toBe(true)
    expect(p.vence - AHORA).toBeLessThanOrEqual(10 * 60 * 1000)
    expect(p.vence).toBeGreaterThan(AHORA)
  })

  it(`sale del registro recién con ${ACIERTOS_PARA_SALIR} aciertos seguidos`, () => {
    let p = aplicarRevision(progresoNuevo(item, AHORA), { nota: 'meFalto', grave: true }, 'fsrs', AHORA)
    p = acertarVeces(p, ACIERTOS_PARA_SALIR - 1)
    expect(p.enErrores).toBe(true)
    p = acertarVeces(p, 1)
    expect(p.enErrores).toBe(false)
    expect(p.aciertosSeguidos).toBeGreaterThanOrEqual(ACIERTOS_PARA_SALIR)
  })

  it('"a medias" corta la racha sin contar como fallo', () => {
    let p = aplicarRevision(progresoNuevo(item, AHORA), { nota: 'meFalto', grave: false }, 'fsrs', AHORA)
    p = acertarVeces(p, 2)
    expect(p.aciertosSeguidos).toBe(2)
    p = aplicarRevision(p, { nota: 'aMedias', grave: false }, 'fsrs', AHORA + 3 * DIA)
    expect(p.aciertosSeguidos).toBe(0)
    expect(p.totalFallos).toBe(1)
    expect(p.enErrores).toBe(true)
  })

  it('leitner recorre 0-1-3-7-16-35 y vuelve a cero al fallar', () => {
    let p = progresoNuevo(item, AHORA)
    const esperados = [1, 3, 7, 16, 35]
    for (const dias of esperados) {
      p = aplicarRevision(p, { nota: 'laTenia', grave: false }, 'leitner', AHORA)
      expect(p.intervaloDias).toBe(dias)
    }
    p = aplicarRevision(p, { nota: 'meFalto', grave: false }, 'leitner', AHORA)
    expect(p.caja).toBe(0)
    expect(p.intervaloDias).toBe(0)
  })

  it('fsrs alarga el intervalo a medida que se acierta', () => {
    let p = progresoNuevo(item, AHORA)
    p = aplicarRevision(p, { nota: 'laTenia', grave: false }, 'fsrs', AHORA)
    const primero = p.vence
    p = aplicarRevision(p, { nota: 'laTenia', grave: false }, 'fsrs', primero)
    expect(p.vence - primero).toBeGreaterThan(0)
    expect(p.estabilidad).toBeGreaterThan(0)
  })
})
