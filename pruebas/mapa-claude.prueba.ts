import { describe, expect, it } from 'vitest'
import { fusionarSecciones, mapaDesdeClaude, textoDeSeccion } from '../src/logica/mapa'
import { armarPedidoMapa } from '../src/importar/claude'

const APUNTE = `Portada y bibliografía del curso.

TEORIA DE LA TIPICIDAD

El concepto de tipo se le atribuye a BELING, quien empleó la expresión
Tatbestand para designar las descripciones de hecho de la ley.

2.- Estructura del tipo.

El tipo penal se compone de un sujeto activo, un sujeto pasivo y un verbo
rector, además del objeto material.

II.- TEORIA DE LA ANTIJURIDICIDAD

La antijuridicidad es la contradicción entre la conducta típica y el
ordenamiento jurídico considerado en su conjunto.`

describe('el mapa que arma Claude', () => {
  const traido = mapaDesdeClaude(APUNTE, [
    { titulo: 'La tipicidad', empieza: 'TEORIA DE LA TIPICIDAD El concepto de tipo se le' },
    { titulo: 'La antijuridicidad', empieza: 'II.- TEORIA DE LA ANTIJURIDICIDAD La antijuridicidad es' },
  ])

  it('usa los títulos que puso Claude, no los del archivo', () => {
    expect(traido.secciones.map((s) => s.titulo)).toEqual(['La tipicidad', 'La antijuridicidad'])
  })

  it('cada tema trae su texto completo, sin huecos', () => {
    const [uno, dos] = traido.secciones
    expect(textoDeSeccion(APUNTE, uno)).toContain('Estructura del tipo')
    expect(textoDeSeccion(APUNTE, dos)).toContain('contradicción entre la conducta')
    expect(uno.fin).toBe(dos.inicio)
    expect(dos.fin).toBe(APUNTE.length)
  })

  it('lo que va antes del primer tema queda dentro al armar el mapa', () => {
    // El locator conserva la posición real; llevar el primero a 0 es cosa del
    // mapa completo, porque un apunte largo se arma por partes.
    expect(traido.secciones[0].inicio).toBeGreaterThan(0)
    const completo = fusionarSecciones(APUNTE, [], traido.secciones)
    expect(completo[0].inicio).toBe(0)
    expect(textoDeSeccion(APUNTE, completo[0])).toContain('Portada')
  })

  it('encuentra el tema aunque Claude arregle una tilde o el espaciado', () => {
    const t = mapaDesdeClaude(APUNTE, [
      { titulo: 'La antijuridicidad', empieza: 'II.-  TEORÍA  DE  LA  ANTIJURÍDICIDAD  La' },
    ])
    expect(t.secciones).toHaveLength(1)
    expect(t.perdidos).toEqual([])
  })

  it('avisa cuál no pudo ubicar en vez de inventar una posición', () => {
    const t = mapaDesdeClaude(APUNTE, [
      { titulo: 'La tipicidad', empieza: 'TEORIA DE LA TIPICIDAD El concepto' },
      { titulo: 'La culpabilidad', empieza: 'esto no está en ninguna parte del apunte' },
    ])
    expect(t.secciones.map((s) => s.titulo)).toEqual(['La tipicidad'])
    expect(t.perdidos).toEqual(['La culpabilidad'])
  })

  it('no devuelve nada si no ubicó ninguno, para poder avisar', () => {
    const t = mapaDesdeClaude(APUNTE, [{ titulo: 'X', empieza: 'nada de esto existe acá' }])
    expect(t.secciones).toEqual([])
    expect(t.perdidos).toEqual(['X'])
  })

  it('ordena los temas por dónde aparecen, aunque vengan al revés', () => {
    const t = mapaDesdeClaude(APUNTE, [
      { titulo: 'La antijuridicidad', empieza: 'II.- TEORIA DE LA ANTIJURIDICIDAD La antijuridicidad' },
      { titulo: 'La tipicidad', empieza: 'TEORIA DE LA TIPICIDAD El concepto de tipo' },
    ])
    expect(t.secciones.map((s) => s.titulo)).toEqual(['La tipicidad', 'La antijuridicidad'])
  })
})

describe('el pedido del mapa', () => {
  const pedido = armarPedidoMapa({
    curso: 'Derecho Penal II',
    titulo: 'Tipicidad.pdf',
    trozo: { numero: 1, total: 1, texto: APUNTE },
  })

  it('manda el texto del apunte', () => {
    expect(pedido).toContain('TEORIA DE LA TIPICIDAD')
  })

  it('explica qué es un tema, no solo pide cortar', () => {
    expect(pedido).toContain('QUÉ ES UN TEMA')
    expect(pedido).toContain('sentada de 20')
  })

  it('pide los títulos en cristiano', () => {
    expect(pedido).toContain('La antijuridicidad')
  })

  it('insiste en que copie las palabras tal cual', () => {
    expect(pedido).toContain('EXACTAMENTE')
    expect(pedido).toContain('no lo encuentro')
  })

  it('avisa cuando el apunte va partido', () => {
    const partido = armarPedidoMapa({
      curso: 'Penal', titulo: 'x.pdf', trozo: { numero: 2, total: 4, texto: APUNTE },
    })
    expect(partido).toContain('trozo 2 de 4')
  })
})

describe('un apunte largo se arma por partes, sin borrar lo anterior', () => {
  const largo = `${'a'.repeat(300)}\n\nPRIMER TEMA\n\nTexto del primero.${'b'.repeat(300)}\n\nSEGUNDO TEMA\n\nTexto del segundo.${'c'.repeat(300)}\n\nTERCER TEMA\n\nTexto del tercero.${'d'.repeat(300)}`

  const parte1 = mapaDesdeClaude(largo, [{ titulo: 'Uno', empieza: 'PRIMER TEMA Texto del primero' }])
  const parte2 = mapaDesdeClaude(largo, [
    { titulo: 'Dos', empieza: 'SEGUNDO TEMA Texto del segundo' },
    { titulo: 'Tres', empieza: 'TERCER TEMA Texto del tercero' },
  ])

  it('la segunda parte se suma a la primera en vez de reemplazarla', () => {
    const juntas = fusionarSecciones(largo, parte1.secciones, parte2.secciones)
    expect(juntas.map((s) => s.titulo)).toEqual(['Uno', 'Dos', 'Tres'])
  })

  it('los cortes quedan bien recalculados, sin huecos ni cruces', () => {
    const juntas = fusionarSecciones(largo, parte1.secciones, parte2.secciones)
    expect(juntas[0].inicio).toBe(0)
    for (let i = 0; i + 1 < juntas.length; i++) {
      expect(juntas[i].fin).toBe(juntas[i + 1].inicio)
      expect(juntas[i].fin).toBeGreaterThan(juntas[i].inicio)
    }
    expect(juntas[juntas.length - 1].fin).toBe(largo.length)
  })

  it('traer dos veces la misma parte no duplica temas', () => {
    const juntas = fusionarSecciones(largo, parte1.secciones, parte1.secciones)
    expect(juntas).toHaveLength(1)
  })

  it('conserva la marca de pasada hecha al refundir', () => {
    const conPasada = parte1.secciones.map((s) => ({ ...s, cubierta: true }))
    const juntas = fusionarSecciones(largo, conPasada, parte1.secciones)
    expect(juntas[0].cubierta).toBe(true)
  })
})
