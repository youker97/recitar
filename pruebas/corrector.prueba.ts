import { describe, expect, it } from 'vitest'
import { clavesDe, puntosDe, revisarJustificacion, revisarRespuesta } from '../src/logica/corrector'
import { contiene } from '../src/logica/comparar'

const PAUTA = [
  { texto: 'Distingue culpa grave de culpa leve', claves: ['culpa grave', 'culpa leve'] },
  { texto: 'Menciona que la culpa grave equivale al dolo', claves: ['equivale al dolo'] },
  { texto: 'Cita el art. 44', claves: ['44'] },
]

describe('corrector automático sin internet', () => {
  it('encuentra la frase aunque cambien tildes y haya un typo', () => {
    expect(contiene('la condicion resolutoria tacita exige sentencia', 'condición resolutoria tácita')).toBe(true)
    expect(contiene('exige sentensia judicial', 'sentencia judicial')).toBe(true)
  })

  it('no encuentra lo que no está', () => {
    expect(contiene('el contrato es ley para las partes', 'indemnización de perjuicios')).toBe(false)
  })

  it('marca los puntos que aparecen en el texto', () => {
    const texto =
      'La culpa grave es la que no emplean ni las personas negligentes y equivale al dolo. ' +
      'La culpa leve es la diligencia ordinaria. Todo esto está en el artículo 44.'
    const r = revisarRespuesta(texto, PAUTA)
    expect(r.encontrados).toBe(3)
    expect(r.puntos.every((p) => p.encontrado)).toBe(true)
  })

  it('deja en rojo lo que faltó y dice qué término no vio', () => {
    const r = revisarRespuesta('La culpa grave y la culpa leve se distinguen por la diligencia.', PAUTA)
    expect(r.encontrados).toBe(1)
    expect(r.puntos[1].encontrado).toBe(false)
    expect(r.puntos[1].faltantes).toContain('equivale al dolo')
  })

  it('no regala puntos con una respuesta vacía o irrelevante', () => {
    expect(revisarRespuesta('No me acuerdo de nada.', PAUTA).encontrados).toBe(0)
    expect(revisarRespuesta('', PAUTA).encontrados).toBe(0)
  })

  it('deduce las claves cuando la pauta no las trae', () => {
    const claves = clavesDe({ texto: 'Menciona la indemnización de perjuicios del art. 1489' })
    expect(claves).toContain('1489')
    expect(claves.some((c) => c.startsWith('indemniz'))).toBe(true)
    expect(claves).not.toContain('menciona')
  })

  it('prefiere frases de dos palabras antes que palabras sueltas', () => {
    const claves = clavesDe({ texto: 'Distingue la culpa grave de la culpa leve' })
    expect(claves).toContain('culpa grave')
    expect(claves).toContain('culpa leve')
    expect(claves).not.toContain('culpa')
  })

  it('no toma formas verbales sueltas como concepto', () => {
    const claves = clavesDe({
      texto: 'El juez puede declararla de oficio cuando aparece de manifiesto en el acto',
    })
    expect(claves.join(' ')).not.toContain('declararla')
    expect(claves.some((c) => c.includes('manifiesto'))).toBe(true)
  })

  it('el ministerio público sale entero, no partido', () => {
    const claves = clavesDe({ texto: 'También el ministerio público en interés de la moral o de la ley' })
    expect(claves).toContain('ministerio público')
  })

  it('no arma frases cruzando puntuación', () => {
    const claves = clavesDe({ texto: 'Carga de la prueba: incumbe probar las obligaciones' })
    expect(claves.join(' | ')).not.toContain('prueba: incumbe')
  })

  it('acepta pautas antiguas de texto pelado', () => {
    expect(puntosDe(['uno', 'dos'])).toEqual([{ texto: 'uno' }, { texto: 'dos' }])
  })

  it('revisa la justificación de un verdadero/falso con sus claves', () => {
    const datos = {
      pregunta: 'p',
      esVerdadera: false,
      justificacion: 'Requiere sentencia judicial.',
      claves: ['sentencia judicial', '1489'],
    }
    const buena = revisarJustificacion('Necesita sentencia judicial conforme al art. 1489.', datos)
    expect(buena.encontrados).toBe(2)
    const mala = revisarJustificacion('Opera solita.', datos)
    expect(mala.encontrados).toBe(0)
  })
})
