import { describe, expect, it } from 'vitest'
import { coincide, coincideArticulo, compararLista, normalizar } from '../src/logica/comparar'

describe('comparación tolerante', () => {
  it('ignora tildes, mayúsculas y puntuación', () => {
    expect(normalizar('¡Obligación Solidaria!')).toBe('obligacion solidaria')
    expect(coincide('objeto licito', 'Objeto lícito')).toBe(true)
  })

  it('acepta artículos y palabras de relleno de más', () => {
    expect(coincide('que tenga una causa licita', 'causa lícita')).toBe(true)
  })

  it('aguanta un error de tipeo', () => {
    expect(coincide('consentimeinto sin vicios', 'consentimiento sin vicios')).toBe(true)
  })

  it('no acepta contenido distinto', () => {
    expect(coincide('objeto lícito', 'causa lícita')).toBe(false)
  })

  it('cuenta cuántos acertó sin exigir el orden', () => {
    const r = compararLista(
      ['causa licita', 'ser capaz', 'objeto licito'],
      ['Que sea legalmente capaz', 'Consentimiento sin vicios', 'Objeto lícito', 'Causa lícita'],
    )
    expect(r.total).toBe(4)
    expect(r.aciertos).toBe(3)
    expect(r.faltantes).toEqual([1])
  })

  it('marca lo que sobra', () => {
    const r = compararLista(['pago', 'novación', 'inventado'], ['Pago', 'Novación'])
    expect(r.aciertos).toBe(2)
    expect(r.sobrantes).toHaveLength(1)
  })

  it('compara números de artículo con o sin "art."', () => {
    expect(coincideArticulo('art. 1489', '1489')).toBe(true)
    expect(coincideArticulo('1489', '1498')).toBe(false)
  })
})
