import { describe, expect, it } from 'vitest'
import { aciertaHueco, prepararHuecos } from '../src/logica/huecos'

const ART_1545 =
  'Todo contrato legalmente celebrado es una ley para los contratantes, y no puede ser invalidado ' +
  'sino por su consentimiento mutuo o por causas legales.'

describe('texto legal con huecos', () => {
  it('oculta palabras con contenido, no artículos ni preposiciones', () => {
    const r = prepararHuecos(ART_1545, 0)
    expect(r.huecos.length).toBeGreaterThanOrEqual(3)
    for (const palabra of r.respuestas) {
      expect(['de', 'la', 'el', 'por', 'y', 'o', 'es', 'una']).not.toContain(palabra.toLowerCase())
    }
  })

  it('no deja dos huecos pegados', () => {
    const r = prepararHuecos(ART_1545, 0)
    for (let i = 1; i < r.huecos.length; i++) {
      expect(r.huecos[i] - r.huecos[i - 1]).toBeGreaterThanOrEqual(2)
    }
  })

  it('cambia los huecos entre repasos, pero es estable dentro del mismo', () => {
    const primera = prepararHuecos(ART_1545, 0).huecos.join(',')
    const otraVez = prepararHuecos(ART_1545, 0).huecos.join(',')
    const segunda = prepararHuecos(ART_1545, 1).huecos.join(',')
    expect(primera).toBe(otraVez)
    expect(primera).not.toBe(segunda)
  })

  it('respeta los huecos forzados con llaves', () => {
    const r = prepararHuecos('Todo contrato legalmente celebrado es una {{ley}} para los contratantes.', 0)
    expect(r.respuestas).toEqual(['ley'])
    expect(r.trozos.map((t) => t.texto).join('')).not.toContain('{{')
  })

  it('perdona tildes y mayúsculas al corregir', () => {
    expect(aciertaHueco('resolucion', 'Resolución')).toBe(true)
    expect(aciertaHueco('resolutoria', 'resolución')).toBe(false)
  })
})
