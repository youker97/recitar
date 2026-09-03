import { describe, expect, it } from 'vitest'
import { evaluarRespuesta, seCorrigeSola } from '../src/logica/evaluar'
import { dominioGeneral, dominioPorBloque, nivelDeDominio } from '../src/logica/dominio'
import { generarAlternativas, puedeGenerarse } from '../src/logica/generador'
import { progresoNuevo } from '../src/logica/programador'
import type { DatosAlternativas, Item } from '../src/datos/tipos'
import type { ItemConProgreso } from '../src/logica/cola'

function item(id: string, tipo: Item['tipo'], datos: Item['datos'], bloque = 'A'): Item {
  return { id, cursoId: 'c', bloque, tipo, datos, ref: '', origen: 'manual', creadoEn: 0, actualizadoEn: 0 }
}

const vf = item('vf1', 'vf', { pregunta: 'p', esVerdadera: false, justificacion: 'j' })
const lista = item('l1', 'lista', {
  titulo: 'Requisitos', elementos: ['Capacidad', 'Consentimiento', 'Objeto lícito', 'Causa lícita'],
})

describe('corrección automática del ensayo', () => {
  it('corrige verdadero y falso', () => {
    expect(evaluarRespuesta(vf, { confianza: 'seguro', esVerdadera: false }).nota).toBe('laTenia')
    expect(evaluarRespuesta(vf, { confianza: 'seguro', esVerdadera: true }).nota).toBe('meFalto')
  })

  it('marca como grave lo que fallé estando seguro', () => {
    const r = evaluarRespuesta(vf, { confianza: 'seguro', esVerdadera: true })
    expect(r.grave).toBe(true)
    expect(evaluarRespuesta(vf, { confianza: 'adivinando', esVerdadera: true }).grave).toBe(false)
  })

  it('acertar adivinando no cuenta como saber', () => {
    expect(evaluarRespuesta(vf, { confianza: 'adivinando', esVerdadera: false }).nota).toBe('aMedias')
  })

  it('la lista se corrige por proporción', () => {
    const casi = evaluarRespuesta(lista, { confianza: 'masOMenos', texto: 'capacidad\nconsentimiento\nobjeto licito\ncausa licita' })
    expect(casi.nota).toBe('laTenia')
    expect(casi.aciertos).toBe(4)
    const media = evaluarRespuesta(lista, { confianza: 'masOMenos', texto: 'capacidad\nobjeto licito' })
    expect(media.nota).toBe('aMedias')
    const nada = evaluarRespuesta(lista, { confianza: 'masOMenos', texto: 'no me acuerdo' })
    expect(nada.nota).toBe('meFalto')
  })

  it('sabe qué se corrige solo y qué no', () => {
    expect(seCorrigeSola(vf)).toBe(true)
    expect(seCorrigeSola(item('d', 'desarrollo', { enunciado: 'e', checklist: ['a', 'b'] }))).toBe(false)
  })
})

describe('alternativas armadas por la app', () => {
  const articulos = [
    item('a1', 'articulo', { numero: '1489', materia: 'Condición resolutoria tácita' }),
    item('a2', 'articulo', { numero: '1698', materia: 'Carga de la prueba' }),
    item('a3', 'articulo', { numero: '1545', materia: 'Ley del contrato' }),
    item('a4', 'articulo', { numero: '1546', materia: 'Buena fe contractual' }),
  ]

  it('arma la pregunta usando otros artículos como distractores', () => {
    const generada = generarAlternativas(articulos[0], articulos)!
    expect(generada).not.toBeNull()
    const d = generada.datos as DatosAlternativas
    expect(generada.tipo).toBe('alternativas')
    expect(d.opciones[d.correcta]).toBe('Condición resolutoria tácita')
    expect(d.opciones.length).toBeGreaterThanOrEqual(3)
    expect(new Set(d.opciones).size).toBe(d.opciones.length)
  })

  it('conserva el ítem original para que el avance siga siendo el mismo', () => {
    const generada = generarAlternativas(articulos[0], articulos)!
    expect(generada.id).toBe('a1')
    expect(generada.bloque).toBe('A')
  })

  it('no arma nada si no hay con qué', () => {
    expect(generarAlternativas(articulos[0], [articulos[0]])).toBeNull()
    expect(puedeGenerarse(vf)).toBe(false)
  })
})

describe('cuánto dominas', () => {
  function dato(id: string, bloque: string, cambios = {}): ItemConProgreso {
    const i = item(id, 'vf', { pregunta: id, esVerdadera: true, justificacion: 'j' }, bloque)
    return { item: i, progreso: { ...progresoNuevo(i), ...cambios } }
  }

  it('un ítem nuevo no suma y uno que aguanta un mes suma entero', () => {
    expect(nivelDeDominio(dato('a', 'A').progreso)).toBe(0)
    expect(nivelDeDominio(dato('b', 'A', { totalRepasos: 4, intervaloDias: 30 }).progreso)).toBe(1)
  })

  it('estar en el registro de errores hunde el dominio', () => {
    const p = dato('c', 'A', { totalRepasos: 5, intervaloDias: 30, enErrores: true }).progreso
    expect(nivelDeDominio(p)).toBeLessThan(0.2)
  })

  it('reporta el porcentaje por bloque, del más flojo al más firme', () => {
    const bloques = dominioPorBloque([
      dato('1', 'Obligaciones', { totalRepasos: 3, intervaloDias: 30 }),
      dato('2', 'Obligaciones', { totalRepasos: 3, intervaloDias: 30 }),
      dato('3', 'Procesal'),
      dato('4', 'Procesal'),
    ])
    expect(bloques[0].bloque).toBe('Procesal')
    expect(bloques[0].porcentaje).toBe(0)
    expect(bloques[1].porcentaje).toBe(100)
    expect(dominioGeneral([
      dato('1', 'A', { totalRepasos: 3, intervaloDias: 30 }),
      dato('2', 'A'),
    ]).porcentaje).toBe(50)
  })
})
