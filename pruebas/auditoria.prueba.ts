import { describe, expect, it } from 'vitest'
import { auditar } from '../src/logica/auditoria'
import type { Item } from '../src/datos/tipos'

const APUNTE = `TEORIA DE LA ANTIJURIDICIDAD

La antijuridicidad es la contradicción entre la conducta típica y el
ordenamiento jurídico. Las causales de justificación la excluyen: quien obra
amparado por una de ellas realiza una conducta típica pero permitida.

El art. 10 del Código Penal enumera las eximentes. La legítima defensa exige
agresión ilegítima, necesidad racional del medio empleado y falta de
provocación suficiente por parte del que se defiende.

Las omisiones impropias suponen posición de garante del bien protegido.`

let n = 0
function item(tipo: Item['tipo'], datos: Item['datos']): Item {
  return {
    id: `i${++n}`, cursoId: 'c', bloque: 'Penal', seccion: 'La antijuridicidad',
    tipo, datos, ref: 'apunte', origen: 'json', creadoEn: 0, actualizadoEn: 0,
  }
}

describe('auditar lo que trajo Claude contra el apunte', () => {
  it('deja pasar un concepto que sí está en el apunte', () => {
    const i = item('concepto', {
      termino: 'posición de garante',
      definicion: 'Deber jurídico específico de evitar un resultado.',
      contexto: 'Las omisiones impropias suponen posición de garante del bien protegido.',
    })
    expect(auditar([i], APUNTE)).toEqual([])
  })

  it('marca el término que no aparece en el apunte', () => {
    const i = item('concepto', {
      termino: 'error de prohibición',
      definicion: 'Creer que se obra conforme a derecho.',
    })
    const r = auditar([i], APUNTE)
    expect(r).toHaveLength(1)
    expect(r[0].motivos[0]).toContain('no aparece en el apunte')
  })

  it('marca la frase "citada" que en realidad no está', () => {
    const i = item('concepto', {
      termino: 'legítima defensa',
      definicion: 'Reacción proporcionada frente a una agresión ilegítima.',
      contexto: 'La legítima defensa es la más antigua de las causales de justificación del derecho.',
    })
    const r = auditar([i], APUNTE)
    expect(r[0].motivos.some((m) => /no está en el texto/.test(m))).toBe(true)
  })

  it('marca el texto legal que trajo de memoria', () => {
    const i = item('textoLegal', {
      numero: '391',
      textoLiteral: 'El que mate a otro y no esté comprendido en el artículo anterior será penado.',
    })
    const r = auditar([i], APUNTE)
    expect(r[0].motivos[0]).toContain('de memoria')
  })

  it('deja pasar el artículo que el apunte sí nombra', () => {
    const i = item('articulo', { numero: '10', materia: 'Eximentes de responsabilidad penal' })
    expect(auditar([i], APUNTE)).toEqual([])
  })

  it('marca el artículo que el apunte nunca nombra', () => {
    const i = item('articulo', { numero: '391', materia: 'Homicidio' })
    const r = auditar([i], APUNTE)
    expect(r[0].motivos[0]).toContain('art. 391')
  })

  it('deja pasar la lista cuyos elementos están en el texto', () => {
    const i = item('lista', {
      titulo: 'Requisitos de la legítima defensa',
      elementos: ['agresión ilegítima', 'necesidad racional del medio empleado', 'falta de provocación suficiente'],
    })
    expect(auditar([i], APUNTE)).toEqual([])
  })

  it('marca la lista que se inventó la mitad', () => {
    const i = item('lista', {
      titulo: 'Requisitos',
      elementos: ['agresión ilegítima', 'ánimo de defensa', 'proporcionalidad estricta', 'actualidad inminente'],
    })
    const r = auditar([i], APUNTE)
    expect(r[0].motivos[0]).toContain('no están en el apunte')
  })

  it('marca la justificación apoyada en un artículo que el apunte no nombra', () => {
    const i = item('vf', {
      pregunta: 'La legítima defensa excluye la tipicidad.',
      esVerdadera: false,
      justificacion: 'Excluye la antijuridicidad.',
      claves: ['antijuridicidad', '391'],
    })
    const r = auditar([i], APUNTE)
    expect(r[0].motivos[0]).toContain('art. 391')
  })

  it('marca el repetido', () => {
    const uno = item('concepto', { termino: 'posición de garante', definicion: 'a' })
    const dos = item('concepto', { termino: 'posición de garante', definicion: 'b' })
    const r = auditar([uno, dos], APUNTE)
    expect(r).toHaveLength(1)
    expect(r[0].itemId).toBe(dos.id)
    expect(r[0].motivos[0]).toContain('repetido')
  })

  it('junta varios motivos en un mismo ítem', () => {
    const i = item('concepto', {
      termino: 'dolo eventual',
      definicion: 'x',
      contexto: 'Una frase que tampoco está en ninguna parte del apunte que te pasé.',
    })
    expect(auditar([i], APUNTE)[0].motivos).toHaveLength(2)
  })
})
