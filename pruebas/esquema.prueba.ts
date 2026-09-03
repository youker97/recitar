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

  it('valida las alternativas y el índice de la correcta', () => {
    const buena = validarPaquete({
      items: [{
        tipo: 'alternativas', bloque: 'A', pregunta: '¿Cuál?',
        opciones: ['una', 'otra', 'tercera'], correcta: 1, explicacion: 'porque sí',
      }],
    })
    expect(buena.ok).toBe(true)

    const mala = validarPaquete({
      items: [{ tipo: 'alternativas', bloque: 'A', pregunta: '¿Cuál?', opciones: ['una', 'otra', 'x'], correcta: 9 }],
    })
    expect(mala.ok).toBe(false)
    expect(mala.errores[0].mensaje).toContain('correcta')

    const pocas = validarPaquete({
      items: [{ tipo: 'alternativas', bloque: 'A', pregunta: '¿Cuál?', opciones: ['una'], correcta: 0 }],
    })
    expect(pocas.ok).toBe(false)
  })

  it('acepta la pauta con claves y también la antigua de textos pelados', () => {
    const conClaves = validarPaquete({
      items: [{
        tipo: 'desarrollo', bloque: 'A', enunciado: 'Explique',
        checklist: [{ texto: 'Cita el 44', claves: ['44'] }, 'Distingue culpa grave'],
      }],
    })
    expect(conClaves.ok).toBe(true)
    const pauta = (conClaves.items[0].datos as { checklist: unknown[] }).checklist
    expect(pauta).toEqual([{ texto: 'Cita el 44', claves: ['44'] }, { texto: 'Distingue culpa grave' }])
  })

  it('guarda las claves de un verdadero/falso', () => {
    const r = validarPaquete({
      items: [{
        tipo: 'vf', bloque: 'A', pregunta: 'p', esVerdadera: true, justificacion: 'j',
        claves: ['sentencia judicial', '1489'],
      }],
    })
    expect(r.ok).toBe(true)
    expect((r.items[0].datos as { claves?: string[] }).claves).toEqual(['sentencia judicial', '1489'])
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
