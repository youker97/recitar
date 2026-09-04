import { describe, expect, it } from 'vitest'
import { abrirEntrega, resumirEntrega, type Entrega } from '../src/logica/entrega'

const APUNTE = `TEORIA DE LA TIPICIDAD

El concepto de tipo se le atribuye a BELING, que empleó la expresión
Tatbestand para las descripciones de hecho de la ley.

II.- TEORIA DE LA ANTIJURIDICIDAD

La antijuridicidad es la contradicción entre la conducta típica y el
ordenamiento jurídico considerado en su conjunto.`

const base = {
  cursoId: 'c1',
  bloque: 'Penal 2',
  fuenteTexto: APUNTE,
  previas: [],
}

const ENTREGA = JSON.stringify({
  recitar: 1,
  entrega: 1,
  de: 4,
  temas: [
    { titulo: 'La tipicidad', empieza: 'TEORIA DE LA TIPICIDAD El concepto de tipo se le' },
    { titulo: 'La antijuridicidad', empieza: 'II.- TEORIA DE LA ANTIJURIDICIDAD La antijuridicidad es' },
  ],
  items: [
    { tipo: 'concepto', seccion: 'La tipicidad', ref: 'apunte', termino: 'tipo penal',
      definicion: 'La descripción legal de la conducta prohibida.' },
    { tipo: 'concepto', seccion: 'La antijuridicidad', ref: 'apunte', termino: 'causal de justificación',
      definicion: 'Permiso que excluye la antijuridicidad de una conducta típica.' },
    { tipo: 'vf', seccion: 'La antijuridicidad', ref: 'art. 10 CP',
      pregunta: 'La legítima defensa excluye la tipicidad.', esVerdadera: false,
      justificacion: 'Excluye la antijuridicidad; la conducta sigue siendo típica.',
      hijos: [{ tipo: 'repregunta', pregunta: '¿Y el exceso?', respuesta: 'Atenúa.' }] },
    { tipo: 'lista', seccion: 'La tipicidad', ref: 'apunte', titulo: 'Elementos del tipo',
      elementos: ['Sujeto activo', 'Sujeto pasivo', 'Verbo rector'] },
  ],
})

describe('abrir una entrega de Claude', () => {
  const e = abrirEntrega({ ...base, texto: ENTREGA }) as Entrega

  it('no devuelve error con una entrega buena', () => {
    expect('error' in e).toBe(false)
  })

  it('arma el mapa con los temas de la entrega', () => {
    expect(e.secciones.map((s) => s.titulo)).toEqual(['La tipicidad', 'La antijuridicidad'])
  })

  it('manda cada pregunta y cada palabra a su tema', () => {
    const deTipicidad = e.items.filter((i) => i.seccion === 'La tipicidad')
    const deAnti = e.items.filter((i) => i.seccion === 'La antijuridicidad')
    expect(deTipicidad.map((i) => i.tipo).sort()).toEqual(['concepto', 'lista'])
    expect(deAnti.some((i) => i.tipo === 'vf')).toBe(true)
    expect(e.sinTema).toBe(0)
  })

  it('le pone a todo el bloque del apunte, no el que diga Claude', () => {
    expect(e.items.every((i) => i.bloque === 'Penal 2')).toBe(true)
  })

  it('trae las repreguntas colgando de su padre', () => {
    const hija = e.items.find((i) => i.tipo === 'repregunta')
    expect(hija?.padreId).toBeTruthy()
    expect(e.items.some((i) => i.id === hija?.padreId)).toBe(true)
  })

  it('sabe por qué entrega va', () => {
    expect(e.numero).toBe(1)
    expect(e.total).toBe(4)
  })

  it('lo cuenta en cristiano', () => {
    expect(resumirEntrega(e, 0)).toBe('Entrega 1 de 4: 2 temas, 2 palabras, 2 preguntas, 1 repregunta.')
  })
})

describe('cuando la entrega viene con problemas', () => {
  it('avisa si no es JSON', () => {
    expect(abrirEntrega({ ...base, texto: 'hola' })).toEqual({
      error: 'Eso no es JSON válido. Copia el bloque de código completo.',
    })
  })

  it('avisa si no trae nada aprovechable', () => {
    const r = abrirEntrega({ ...base, texto: '{"recitar":1,"temas":[],"items":[]}' })
    expect('error' in r).toBe(true)
  })

  it('cuenta el tema que no pudo ubicar en vez de inventarlo', () => {
    const r = abrirEntrega({
      ...base,
      texto: JSON.stringify({
        temas: [
          { titulo: 'La tipicidad', empieza: 'TEORIA DE LA TIPICIDAD El concepto' },
          { titulo: 'Inventado', empieza: 'esto no está en el apunte para nada' },
        ],
        items: [],
      }),
    }) as Entrega
    expect(r.secciones.map((s) => s.titulo)).toEqual(['La tipicidad'])
    expect(r.perdidos).toEqual(['Inventado'])
  })

  it('cuenta los ítems cuyo tema no calza, y aun así los guarda', () => {
    const r = abrirEntrega({
      ...base,
      texto: JSON.stringify({
        temas: [{ titulo: 'La tipicidad', empieza: 'TEORIA DE LA TIPICIDAD El concepto' }],
        items: [{ tipo: 'concepto', seccion: 'Un tema que no mandó', ref: 'x',
          termino: 'dolo', definicion: 'Conocer y querer la realización del tipo.' }],
      }),
    }) as Entrega
    expect(r.sinTema).toBe(1)
    expect(r.items).toHaveLength(1)
  })

  it('una entrega solo de preguntas se suma al mapa que ya había', () => {
    const previas = [{ titulo: 'La tipicidad', inicio: 0, fin: APUNTE.length, cubierta: true }]
    const r = abrirEntrega({
      ...base,
      previas,
      texto: JSON.stringify({
        items: [{ tipo: 'concepto', seccion: 'La tipicidad', ref: 'x',
          termino: 'dolo', definicion: 'Conocer y querer la realización del tipo.' }],
      }),
    }) as Entrega
    expect(r.secciones).toEqual(previas)
    expect(r.items[0].seccion).toBe('La tipicidad')
    expect(r.sinTema).toBe(0)
  })
})
