import { describe, expect, it } from 'vitest'
import { armarPedidoVocabulario } from '../src/importar/claude'
import { validarPaquete } from '../src/datos/esquema'

const TEXTO = `II.- LA ANTIJURIDICIDAD

La funcion indiciaria, en cuya virtud la tipicidad constituye un indicio de la
antijuridicidad, supone que verificada aquella se presume esta mientras no
concurra una causal de justificacion. Como sucede en otras materias, esta
teoria tiene matices.`

const PEDIDO = armarPedidoVocabulario({
  curso: 'Derecho Penal',
  tema: 'La antijuridicidad',
  trozo: { numero: 1, total: 1, texto: TEXTO },
})

describe('pedido de vocabulario', () => {
  it('manda el texto del tema, no una lista de términos que sacó la app', () => {
    expect(PEDIDO).toContain('funcion indiciaria')
    expect(PEDIDO).toContain('TEXTO DEL TEMA')
  })

  it('dice de qué ramo y de qué tema se trata', () => {
    expect(PEDIDO).toContain('Derecho Penal')
    expect(PEDIDO).toContain('La antijuridicidad')
  })

  it('deja fuera los pedazos de oración, que era lo que ensuciaba la lista', () => {
    expect(PEDIDO).toContain('QUÉ NO CUENTA')
    expect(PEDIDO).toContain('como sucede')
    expect(PEDIDO).toContain('esta teoría')
  })

  it('pide distinguir lo que dice el apunte de lo que dedujo Claude', () => {
    expect(PEDIDO).toContain('"apunte"')
    expect(PEDIDO).toContain('"claude"')
    expect(PEDIDO).toContain('revisar con mi profesor')
  })

  it('pide la frase del apunte y prohíbe inventarla', () => {
    expect(PEDIDO).toContain('copiada tal cual')
    expect(PEDIDO).toContain('antes que inventarla')
  })

  it('avisa cuando el tema va partido, para que no repita términos', () => {
    const partido = armarPedidoVocabulario({
      curso: 'Penal',
      tema: 'Tipicidad',
      trozo: { numero: 2, total: 3, texto: TEXTO },
    })
    expect(partido).toContain('trozo 2 de 3')
  })
})

describe('respuesta de Claude con conceptos', () => {
  it('acepta un concepto completo', () => {
    const validado = validarPaquete({
      recitar: 1,
      items: [{
        tipo: 'concepto',
        bloque: 'Penal',
        seccion: 'La antijuridicidad',
        termino: 'posición de garante',
        definicion: 'Deber jurídico específico de evitar un resultado.',
        contexto: 'las omisiones impropias suponen posición de garante…',
        fuente: 'apunte',
        ref: 'apunte cl. 5',
      }],
    })
    expect(validado.ok).toBe(true)
    expect(validado.items[0].datos).toMatchObject({
      termino: 'posición de garante',
      fuente: 'apunte',
    })
  })

  it('rechaza un concepto sin definición', () => {
    const validado = validarPaquete({
      items: [{ tipo: 'concepto', bloque: 'Penal', termino: 'enajenación', ref: 'x' }],
    })
    expect(validado.ok).toBe(false)
    expect(validado.errores[0].mensaje).toContain('definicion')
  })

  it('ante una fuente rara asume que la dedujo Claude, para poder revisarla', () => {
    const validado = validarPaquete({
      items: [{ tipo: 'concepto', bloque: 'Penal', termino: 'x', definicion: 'y', fuente: 'wikipedia', ref: 'z' }],
    })
    expect(validado.items[0].datos).toMatchObject({ fuente: 'claude' })
  })
})
