import { describe, expect, it } from 'vitest'
import { aItems, validarPaquete } from '../src/datos/esquema'
import ejemplo from '../src/datos/ejemplo.json'

describe('validación de paquetes', () => {
  it('acepta el paquete de ejemplo completo', () => {
    const r = validarPaquete(ejemplo)
    expect(r.errores).toEqual([])
    expect(r.ok).toBe(true)
    expect(r.curso).toBe('Civil — ejemplo')
    expect(r.items.length).toBeGreaterThan(5)
  })

  it('dice qué campo falta y en qué ítem', () => {
    const r = validarPaquete({
      items: [
        { tipo: 'vf', bloque: 'A', pregunta: 'p', esVerdadera: true, justificacion: 'j' },
        { tipo: 'vf', bloque: 'A', pregunta: 'p' },
      ],
    })
    expect(r.ok).toBe(false)
    expect(r.errores.some((e) => e.donde === 'ítem 2' && e.mensaje.includes('esVerdadera'))).toBe(true)
    expect(r.errores.some((e) => e.donde === 'ítem 2' && e.mensaje.includes('justificacion'))).toBe(true)
  })

  it('rechaza un tipo inventado y lista los válidos', () => {
    const r = validarPaquete({ items: [{ tipo: 'flashcard', bloque: 'A' }] })
    expect(r.ok).toBe(false)
    expect(r.errores[0].mensaje).toContain('vf')
  })

  it('exige que esVerdadera sea booleano, no texto', () => {
    const r = validarPaquete({
      items: [{ tipo: 'vf', bloque: 'A', pregunta: 'p', esVerdadera: 'true', justificacion: 'j' }],
    })
    expect(r.ok).toBe(false)
    expect(r.errores[0].mensaje).toContain('sin comillas')
  })

  it('señala el error dentro de una repregunta, no solo el del padre', () => {
    const r = validarPaquete({
      items: [{
        tipo: 'vf', bloque: 'A', pregunta: 'p', esVerdadera: false, justificacion: 'j',
        hijos: [{ tipo: 'repregunta', pregunta: 'sin respuesta' }],
      }],
    })
    expect(r.ok).toBe(false)
    expect(r.errores[0].donde).toContain('repregunta 1')
  })

  it('hereda el bloque del padre en las repreguntas', () => {
    const r = validarPaquete({
      items: [{
        tipo: 'vf', bloque: 'Obligaciones', pregunta: 'p', esVerdadera: true, justificacion: 'j',
        hijos: [{ tipo: 'repregunta', pregunta: 'q', respuesta: 'r' }],
      }],
    })
    expect(r.ok).toBe(true)
    expect(r.items[0].hijos[0].bloque).toBe('Obligaciones')
  })

  it('acepta una lista pelada de ítems', () => {
    const r = validarPaquete([{ tipo: 'articulo', bloque: 'A', numero: '1', materia: 'm' }])
    expect(r.ok).toBe(true)
  })

  it('avisa cuando el archivo no trae ítems', () => {
    expect(validarPaquete({ curso: 'X' }).errores[0].mensaje).toContain('items')
    expect(validarPaquete({ curso: 'X', items: [] }).errores[0].mensaje).toContain('ningún ítem')
  })

  it('al convertir, las repreguntas quedan colgando del padre y en orden', () => {
    const r = validarPaquete(ejemplo)
    const items = aItems(r.items, 'curso1')
    const padre = items.find((i) => i.tipo === 'vf')!
    const hijos = items.filter((i) => i.padreId === padre.id)
    expect(hijos.length).toBeGreaterThan(0)
    expect(hijos.map((h) => h.orden)).toEqual(hijos.map((_, k) => k))
    expect(items.every((i) => i.cursoId === 'curso1')).toBe(true)
  })
})
