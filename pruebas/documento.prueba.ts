import { describe, expect, it } from 'vitest'
import { aDocumento } from '../src/logica/documento'

const APUNTE = `1

TEORIA DE LA TIPICIDAD

1.- Noción y sentido.

El concepto de tipo, tal como se estudia y comprende actualmente, se le
atribuye a BELING, quien empleó la expresión alemana Tatbestand para designar
las descripciones de hecho contempladas por la ley.

ARTÍCULO 578 DEL CÓDIGO CIVIL: "Derechos personales o créditos son los que sólo
pueden reclamarse de ciertas personas, que, por un hecho suyo o la sola
disposición de la ley, han contraído las obligaciones correlativas."

2.1.- Estructura del tipo.

El tipo se compone de:

- Un sujeto activo
- Un sujeto pasivo
- Un verbo rector

Página 12

El artículo 578 está en el Libro II y no pretende definir las fuentes.`

const doc = aDocumento(APUNTE)

describe('el apunte se lee como documento, no como un muro', () => {
  it('bota los números de página que deja el PDF', () => {
    expect(doc.some((b) => b.clase === 'parrafo' && b.texto === '1')).toBe(false)
    expect(doc.some((b) => 'texto' in b && /^Página 12$/.test(b.texto))).toBe(false)
  })

  it('reconoce el título en mayúsculas como el de arriba', () => {
    expect(doc[0]).toEqual({ clase: 'titulo', nivel: 1, texto: 'TEORIA DE LA TIPICIDAD' })
  })

  it('reconoce la numeración chilena y su jerarquía', () => {
    const titulos = doc.filter((b) => b.clase === 'titulo')
    expect(titulos).toContainEqual({ clase: 'titulo', nivel: 2, texto: '1.- Noción y sentido.' })
    expect(titulos).toContainEqual({ clase: 'titulo', nivel: 3, texto: '2.1.- Estructura del tipo.' })
  })

  it('separa la cita literal del artículo, con su rótulo', () => {
    const cita = doc.find((b) => b.clase === 'cita')
    expect(cita).toBeDefined()
    expect(cita).toMatchObject({ clase: 'cita' })
    if (cita?.clase === 'cita') {
      expect(cita.fuente?.toLowerCase()).toContain('578')
      expect(cita.texto).toContain('Derechos personales')
    }
  })

  it('arma la enumeración con sus puntos, sin la viñeta', () => {
    const lista = doc.find((b) => b.clase === 'lista')
    expect(lista).toMatchObject({
      clase: 'lista',
      ordenada: false,
      puntos: ['Un sujeto activo', 'Un sujeto pasivo', 'Un verbo rector'],
    })
  })

  it('un párrafo que solo menciona un artículo sigue siendo un párrafo', () => {
    const ultimo = doc[doc.length - 1]
    expect(ultimo.clase).toBe('parrafo')
    expect('texto' in ultimo && ultimo.texto).toContain('Libro II')
  })

  it('junta los renglones cortados a mitad de frase', () => {
    const p = doc.find((b) => b.clase === 'parrafo' && b.texto.includes('BELING'))
    expect(p && 'texto' in p && p.texto).toContain('atribuye a BELING')
  })

  it('no confunde una frase larga con un título', () => {
    const doc2 = aDocumento('La tipicidad es la adecuación de una conducta concreta a la descripción abstracta contenida en el tipo penal.')
    expect(doc2[0].clase).toBe('parrafo')
  })

  it('una numeración de verdad ordenada se marca como tal', () => {
    const doc3 = aDocumento('Son dos:\n\n1) El hecho del deudor\n2) La sola disposición de la ley')
    const lista = doc3.find((b) => b.clase === 'lista')
    expect(lista).toMatchObject({ ordenada: true, puntos: ['El hecho del deudor', 'La sola disposición de la ley'] })
  })
})

describe('el rótulo de la cita no se repite dentro del texto', () => {
  it('saca el nombre del artículo del cuerpo cuando va delante', () => {
    const doc = aDocumento(
      'ARTÍCULO 578 DEL CÓDIGO CIVIL: "Derechos personales o créditos son los que sólo pueden reclamarse de ciertas personas que han contraído las obligaciones correlativas."',
    )
    const cita = doc[0]
    expect(cita.clase).toBe('cita')
    if (cita.clase === 'cita') {
      expect(cita.fuente).toBe('ARTÍCULO 578 DEL CÓDIGO CIVIL')
      expect(cita.texto.startsWith('Derechos personales')).toBe(true)
      expect(cita.texto).not.toContain('ARTÍCULO 578')
    }
  })

  it('no recorta cuando el artículo es parte de la frase', () => {
    const doc = aDocumento(
      'Art. 1489 y siguientes regulan la condición resolutoria tácita, que es una de las materias más preguntadas del curso completo.',
    )
    const cita = doc[0]
    if (cita.clase === 'cita') expect(cita.texto).toContain('y siguientes')
  })
})
