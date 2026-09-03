import { describe, expect, it } from 'vitest'
import { cadenaCompleta, hijosDe, tieneHijos } from '../src/logica/cadena'
import type { Item } from '../src/datos/tipos'

function crear(id: string, padreId?: string, orden?: number, suspendido?: boolean): Item {
  return {
    id, cursoId: 'c', bloque: 'A', tipo: 'repregunta',
    datos: { pregunta: id, respuesta: 'r' },
    ref: '', padreId, orden, suspendido, origen: 'manual', creadoEn: 0, actualizadoEn: 0,
  }
}

describe('modo cadena', () => {
  const items = [
    crear('padre'),
    crear('h2', 'padre', 2),
    crear('h1', 'padre', 1),
    crear('nieto', 'h1', 1),
    crear('suspendida', 'padre', 3, true),
    crear('ajena'),
  ]

  it('trae los hijos en orden y sin los suspendidos', () => {
    expect(hijosDe(items, 'padre').map((i) => i.id)).toEqual(['h1', 'h2'])
  })

  it('sabe si un ítem tiene repreguntas', () => {
    expect(tieneHijos(items, 'padre')).toBe(true)
    expect(tieneHijos(items, 'ajena')).toBe(false)
  })

  it('recorre la cadena en profundidad: la repregunta de la repregunta va después', () => {
    expect(cadenaCompleta(items, 'padre').map((i) => i.id)).toEqual(['h1', 'nieto', 'h2'])
  })
})
