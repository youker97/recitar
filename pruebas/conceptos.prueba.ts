import { describe, expect, it } from 'vitest'
import { conceptosDeBloque, conceptosDeTexto, revisarVolcado } from '../src/logica/conceptos'
import { presentar } from '../src/logica/mapa'
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

const APUNTE = `TEORIA DE LA TIPICIDAD

1.- Nocion y sentido.

La tipicidad es la adecuacion de una conducta concreta a la descripcion abstracta contenida en el
tipo penal. La funcion garantista del tipo deriva del principio de legalidad, que impide castigar
comportamientos no descritos previamente. De alli que se afirme que no hay delito sin tipo.

2.- Estructura del tipo.

El tipo penal se compone de un sujeto activo, un sujeto pasivo, una conducta descrita mediante un
verbo rector, un objeto material y un bien juridico protegido. El sujeto activo es quien realiza la
conducta. El sujeto pasivo es el titular del bien juridico lesionado. El objeto material es la cosa
sobre la que recae la accion, y el bien juridico protegido es el interes que la norma resguarda.

3.- Elementos descriptivos y normativos.

Los elementos descriptivos se captan por los sentidos. Los elementos normativos exigen una
valoracion. La distincion entre elementos descriptivos y normativos importa para el error de tipo,
porque el error sobre elementos normativos se trata de otra manera que el error sobre elementos
descriptivos. El bien juridico vuelve a aparecer al interpretar los elementos normativos.`

describe('conceptos sacados del apunte, sin preguntas todavía', () => {
  const conceptos = conceptosDeTexto(APUNTE, 'Tipicidad', 'Apunte')
  const terminos = conceptos.map((c) => c.termino.toLowerCase())

  it('toma el título del apunte como concepto', () => {
    expect(terminos.some((t) => t.includes('teoria de la tipicidad'))).toBe(true)
  })

  it('reconoce los términos técnicos que se repiten', () => {
    expect(terminos.some((t) => t.includes('elementos descriptivos'))).toBe(true)
    expect(terminos.some((t) => t.includes('elementos normativos'))).toBe(true)
  })

  it('toma las frases que se repiten, no las que aparecen una vez', () => {
    expect(terminos.some((t) => t.includes('bien juridico'))).toBe(true)
    expect(terminos.some((t) => t.includes('sujeto'))).toBe(true)
  })

  it('no ofrece un término que es pedazo de otro', () => {
    // "bien juridico" y "bien juridico protegido" son lo mismo partido en dos:
    // preguntar los dos no es vocabulario, es ruido.
    for (const t of terminos) {
      const contenido = terminos.some((otro) => otro !== t && otro.length > t.length && otro.includes(t))
      expect(contenido, `"${t}" es pedazo de otro término`).toBe(false)
    }
  })

  it('no corta las frases en una coma', () => {
    expect(terminos.some((t) => t.includes(','))).toBe(false)
  })

  it('no toma frases de relleno', () => {
    expect(terminos.some((t) => t.includes('otra manera'))).toBe(false)
    expect(terminos.some((t) => t.includes('vuelve a aparecer'))).toBe(false)
  })

  it('un volcado que nombra la materia puntúa de verdad', () => {
    const bueno =
      'La estructura del tipo comprende sujeto activo, sujeto pasivo, objeto material y ' +
      'bien juridico protegido. Los elementos descriptivos se captan por los sentidos y los ' +
      'normativos exigen valoracion.'
    const r = revisarVolcado(bueno, conceptos)
    expect(r.cobertura).toBeGreaterThan(35)
  })

  it('un volcado en blanco no puntúa', () => {
    expect(revisarVolcado('No me acuerdo de nada.', conceptos).cobertura).toBe(0)
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

describe('cómo se muestra un término sacado del texto', () => {
  it('baja los títulos que vienen gritados', () => {
    expect(presentar('TEORIA DE LA ANTIJURIDICIDAD')).toBe('Teoria de la antijuridicidad')
  })

  it('le saca la numeración chilena del título', () => {
    expect(presentar('II.- TEORIA DE LA ANTIJURIDICIDAD')).toBe('Teoria de la antijuridicidad')
    expect(presentar('1.- Nocion y sentido')).toBe('Nocion y sentido')
  })

  it('no toca un término que ya se lee bien', () => {
    expect(presentar('bien jurídico protegido')).toBe('bien jurídico protegido')
  })

  it('respeta las siglas dentro de una frase normal', () => {
    expect(presentar('el tipo penal del CP')).toBe('el tipo penal del CP')
  })

  it('no convierte los números romanos en minúscula', () => {
    expect(presentar('BLOQUE I — EL CONTRATO')).toBe('Bloque I — el contrato')
    expect(presentar('TITULO XXXIII DEL LIBRO IV')).toBe('Titulo XXXIII del libro IV')
  })

  it('deja las siglas legales como están al bajar un título gritado', () => {
    expect(presentar('EL ARTICULO 19 DE LA CPR')).toBe('El articulo 19 de la CPR')
    expect(presentar('LAS FUENTES SEGUN EL CC')).toBe('Las fuentes segun el CC')
  })

  it('sí baja las palabras corrientes cortas', () => {
    expect(presentar('EL USO DE LA COSA')).toBe('El uso de la cosa')
  })
})
