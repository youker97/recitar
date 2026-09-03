import { describe, expect, it } from 'vitest'
import { conceptosDeBloque, revisarVolcado } from '../src/logica/conceptos'
import { calibracion, prontitudEn, retrievabilidad } from '../src/logica/prontitud'
import { progresoNuevo } from '../src/logica/programador'
import type { Item, Revision } from '../src/datos/tipos'
import type { ItemConProgreso } from '../src/logica/cola'

function item(id: string, tipo: Item['tipo'], datos: Item['datos'], bloque = 'Obligaciones'): Item {
  return { id, cursoId: 'c', bloque, tipo, datos, ref: `ref ${id}`, origen: 'manual', creadoEn: 0, actualizadoEn: 0 }
}

const ITEMS = [
  item('1', 'vf', {
    pregunta: 'p', esVerdadera: false, justificacion: 'j',
    claves: ['condición resolutoria tácita', 'sentencia judicial'],
  }),
  item('2', 'lista', {
    titulo: 'Modos de extinguir', elementos: ['Pago', 'Novación', 'Compensación'],
  }),
  item('3', 'articulo', { numero: '1489', materia: 'Condición resolutoria tácita' }),
  item('4', 'triaje', { enunciado: 'e', bloque: 'Obligaciones', verbo: 'definir' }),
]

describe('conceptos de un bloque', () => {
  const conceptos = conceptosDeBloque(ITEMS)

  it('saca los términos del propio material', () => {
    const terminos = conceptos.map((c) => c.termino)
    expect(terminos).toContain('condición resolutoria tácita')
    expect(terminos).toContain('Novación')
    expect(terminos).toContain('1489')
  })

  it('no repite lo que ya está, aunque venga de otro ítem', () => {
    const normalizados = conceptos.map((c) => c.termino.toLowerCase())
    expect(new Set(normalizados).size).toBe(normalizados.length)
  })

  it('deja fuera el triaje, que no es contenido que producir', () => {
    expect(conceptos.some((c) => c.itemId === '4')).toBe(false)
  })

  it('cada concepto sabe de qué ítem salió, para poder ir a estudiarlo', () => {
    expect(conceptos.every((c) => c.itemId && c.ref)).toBe(true)
  })
})

describe('volcado', () => {
  const conceptos = conceptosDeBloque(ITEMS)

  it('cuenta lo que apareció en el texto escrito de memoria', () => {
    const r = revisarVolcado(
      'Me acuerdo de la condicion resolutoria tacita del 1489, que exige sentencia judicial. ' +
      'Los modos de extinguir incluyen el pago y la novación.',
      conceptos,
    )
    expect(r.encontrados.map((c) => c.termino)).toContain('1489')
    expect(r.encontrados.map((c) => c.termino)).toContain('Novación')
    expect(r.cobertura).toBeGreaterThan(40)
  })

  it('lo que no se escribió queda listado como faltante', () => {
    const r = revisarVolcado('Solo me acuerdo del pago.', conceptos)
    expect(r.faltantes.map((c) => c.termino)).toContain('1489')
    expect(r.encontrados.map((c) => c.termino)).toContain('Pago')
  })

  it('una hoja vacía no regala nada', () => {
    expect(revisarVolcado('', conceptos).cobertura).toBe(0)
  })
})

describe('prontitud: cuánto recordarías el día de la prueba', () => {
  const HOY = new Date(2026, 8, 3).getTime()
  const DIA = 24 * 60 * 60 * 1000

  function dato(id: string, cambios = {}): ItemConProgreso {
    const i = item(id, 'vf', { pregunta: id, esVerdadera: true, justificacion: 'j' })
    return { item: i, progreso: { ...progresoNuevo(i, HOY), ...cambios } }
  }

  it('un ítem nunca estudiado se recuerda 0', () => {
    expect(retrievabilidad(dato('a').progreso, HOY)).toBe(0)
  })

  it('recién repasado se recuerda casi entero', () => {
    const p = dato('b', { totalRepasos: 1, estabilidad: 10, ultimoRepaso: HOY }).progreso
    expect(retrievabilidad(p, HOY)).toBeCloseTo(1, 2)
  })

  it('el recuerdo baja a medida que pasan los días', () => {
    const p = dato('c', { totalRepasos: 1, estabilidad: 10, ultimoRepaso: HOY }).progreso
    const enUnaSemana = retrievabilidad(p, HOY + 7 * DIA)
    const enUnMes = retrievabilidad(p, HOY + 30 * DIA)
    expect(enUnaSemana).toBeLessThan(1)
    expect(enUnMes).toBeLessThan(enUnaSemana)
    expect(enUnMes).toBeGreaterThan(0)
  })

  it('a mayor estabilidad, más aguanta', () => {
    const flojo = dato('d', { totalRepasos: 1, estabilidad: 2, ultimoRepaso: HOY }).progreso
    const firme = dato('e', { totalRepasos: 1, estabilidad: 60, ultimoRepaso: HOY }).progreso
    expect(retrievabilidad(firme, HOY + 30 * DIA)).toBeGreaterThan(retrievabilidad(flojo, HOY + 30 * DIA))
  })

  it('resume el porcentaje esperado y marca los que se van a caer', () => {
    const datos = [
      dato('1', { totalRepasos: 1, estabilidad: 200, ultimoRepaso: HOY }),
      dato('2', { totalRepasos: 1, estabilidad: 1, ultimoRepaso: HOY - 20 * DIA }),
      dato('3'),
    ]
    const r = prontitudEn(datos, '2026-09-13')
    expect(r.enJuego).toBe(3)
    expect(r.sinVer).toBe(1)
    expect(r.esperado).toBeGreaterThan(0)
    expect(r.esperado).toBeLessThan(100)
    expect(r.enPeligro.map((d) => d.item.id)).toContain('3')
  })
})

describe('calibración', () => {
  function revision(confianza: Revision['confianza'], nota: Revision['nota']): Revision {
    return {
      itemId: 'i', cursoId: 'c', bloque: 'A', tipo: 'vf', fecha: 0, modo: 'vf',
      confianza, nota, grave: confianza === 'seguro' && nota === 'meFalto', duracionMs: 0,
    }
  }

  it('mide cuánto aciertas cuando dices que estás seguro', () => {
    const r = calibracion([
      revision('seguro', 'laTenia'),
      revision('seguro', 'meFalto'),
      revision('seguro', 'meFalto'),
      revision('seguro', 'laTenia'),
      revision('adivinando', 'meFalto'),
    ])
    const seguro = r.filas.find((f) => f.confianza === 'seguro')!
    expect(seguro.intentos).toBe(4)
    expect(seguro.razon).toBe(50)
  })

  it('el exceso es positivo cuando te crees más de lo que sabes', () => {
    const creido = calibracion([revision('seguro', 'meFalto'), revision('seguro', 'meFalto')])
    expect(creido.exceso).toBeGreaterThan(50)
    const justo = calibracion([revision('seguro', 'laTenia'), revision('seguro', 'laTenia')])
    expect(justo.exceso).toBe(0)
  })
})
