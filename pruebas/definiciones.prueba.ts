import { describe, expect, it } from 'vitest'
import { aparicionesDe, buscarDefinicion } from '../src/logica/definiciones'
import { armarPedidoVocabulario } from '../src/importar/claude'
import { validarPaquete } from '../src/datos/esquema'

const APUNTE = `LA ENAJENACIÓN

En sentido amplio se entiende por enajenación todo acto de disposición entre vivos por el
cual el titular transfiere su derecho a otra persona o constituye sobre él un derecho real
limitativo. El art. 1464 del Código Civil declara que hay objeto ilícito en la enajenación
de las cosas que no están en el comercio.

La tradición es un modo de adquirir el dominio. Cuando el deudor paga, extingue la
obligación y la enajenación ya se ha consumado respecto de terceros.`

describe('definiciones dentro del propio apunte', () => {
  it('encuentra la frase que define el término', () => {
    const hallazgo = buscarDefinicion(APUNTE, 'enajenación')
    expect(hallazgo.definicion).toContain('se entiende por enajenación')
  })

  it('devuelve además la frase donde aparece', () => {
    const hallazgo = buscarDefinicion(APUNTE, 'tradición')
    expect(hallazgo.contexto).toContain('modo de adquirir el dominio')
  })

  it('no inventa definición cuando el apunte solo menciona el término', () => {
    const hallazgo = buscarDefinicion(APUNTE, 'tradición')
    expect(hallazgo.definicion).toBeNull()
  })

  it('avisa con null cuando el término no está en el texto', () => {
    expect(buscarDefinicion(APUNTE, 'usucapión')).toEqual({ definicion: null, contexto: null })
  })

  it('no corta la frase en "art." ni pierde el artículo', () => {
    const hallazgo = buscarDefinicion(APUNTE, 'objeto ilícito')
    expect(hallazgo.contexto).toContain('art. 1464')
  })

  it('encuentra el término aunque cambien las tildes', () => {
    expect(buscarDefinicion(APUNTE, 'enajenacion').definicion).not.toBeNull()
  })

  it('junta las apariciones para dárselas de contexto a Claude', () => {
    const frases = aparicionesDe(APUNTE, 'enajenación')
    expect(frases.length).toBeGreaterThanOrEqual(2)
    expect(frases.length).toBeLessThanOrEqual(3)
  })
})

describe('pedido de vocabulario', () => {
  const pedido = armarPedidoVocabulario({
    curso: 'Derecho Civil',
    tema: 'La enajenación',
    terminos: [
      { termino: 'enajenación', apariciones: aparicionesDe(APUNTE, 'enajenación') },
      { termino: 'usucapión', apariciones: [] },
    ],
  })

  it('va una sola vez con todos los términos', () => {
    expect(pedido).toContain('1. enajenación')
    expect(pedido).toContain('2. usucapión')
  })

  it('lleva las frases del apunte como contexto', () => {
    expect(pedido).toContain('se entiende por enajenación')
  })

  it('dice cuándo un término no está explicado', () => {
    expect(pedido).toContain('no aparece explicado en el apunte')
  })

  it('pide derecho chileno y el ramo, no el diccionario', () => {
    expect(pedido).toContain('Derecho Civil')
    expect(pedido).toContain('derecho chileno')
  })
})

describe('respuesta de Claude con conceptos', () => {
  it('acepta un concepto completo', () => {
    const validado = validarPaquete({
      recitar: 1,
      items: [{
        tipo: 'concepto',
        bloque: 'Derecho Civil',
        seccion: 'La enajenación',
        termino: 'enajenación',
        definicion: 'Todo acto de disposición entre vivos.',
        contexto: 'En sentido amplio se entiende por enajenación…',
        fuente: 'apunte',
        ref: 'art. 1464 CC',
      }],
    })
    expect(validado.ok).toBe(true)
    expect(validado.items[0].datos).toMatchObject({ termino: 'enajenación', fuente: 'apunte' })
  })

  it('rechaza un concepto sin definición', () => {
    const validado = validarPaquete({
      items: [{ tipo: 'concepto', bloque: 'Civil', termino: 'enajenación', ref: 'x' }],
    })
    expect(validado.ok).toBe(false)
    expect(validado.errores[0].mensaje).toContain('definicion')
  })

  it('ante una fuente rara asume que la dedujo Claude, para poder revisarla', () => {
    const validado = validarPaquete({
      items: [{ tipo: 'concepto', bloque: 'Civil', termino: 'x', definicion: 'y', fuente: 'wikipedia', ref: 'z' }],
    })
    expect(validado.items[0].datos).toMatchObject({ fuente: 'claude' })
  })
})
