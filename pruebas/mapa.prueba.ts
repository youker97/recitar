import { describe, expect, it } from 'vitest'
import { detectarSecciones, textoDeSeccion } from '../src/logica/mapa'
import { calcularAlcance, estadoDeItem, filtrarPorAlcance } from '../src/logica/alcance'
import { proximaJugada } from '../src/logica/siguiente'
import { progresoNuevo } from '../src/logica/programador'
import { AJUSTES_POR_DEFECTO, type Fuente, type Item } from '../src/datos/tipos'
import type { ItemConProgreso } from '../src/logica/cola'

const APUNTE = `La antijuridicidad

La antijuridicidad es la contradicción entre la conducta típica y el ordenamiento jurídico
considerado en su conjunto. Se distingue entre antijuridicidad formal y material, según se atienda
a la contravención de la norma o a la lesión del bien jurídico protegido por ella.

Causales de justificación

Las causales de justificación excluyen la antijuridicidad de la conducta típica. El Código Penal
chileno las trata principalmente en el artículo 10, que enumera las circunstancias eximentes de
responsabilidad penal. Quien obra amparado por una causal de justificación no comete delito.

Legítima defensa

La legítima defensa exige agresión ilegítima, necesidad racional del medio empleado para impedirla
o repelerla, y falta de provocación suficiente por parte del que se defiende. Está en el artículo
10 número 4 del Código Penal y es la causal de justificación más discutida en doctrina.`

function item(id: string, seccion?: string): Item {
  return {
    id, cursoId: 'c', bloque: 'Antijuridicidad', seccion, tipo: 'vf',
    datos: { pregunta: id, esVerdadera: true, justificacion: 'j' },
    ref: '', origen: 'json', creadoEn: 0, actualizadoEn: 0,
  }
}

function dato(id: string, seccion?: string, cambios = {}): ItemConProgreso {
  const i = item(id, seccion)
  return { item: i, progreso: { ...progresoNuevo(i), ...cambios } }
}

function fuente(secciones: ReturnType<typeof detectarSecciones>, hasta: number): Fuente {
  return {
    id: 'f1', cursoId: 'c', bloque: 'Antijuridicidad', titulo: 'Apunte de penal',
    texto: APUNTE, creadoEn: 0, secciones, hasta, avance: 0, terminada: false,
  }
}

describe('mapa del apunte', () => {
  const secciones = detectarSecciones(APUNTE)

  it('parte el apunte por sus propios títulos', () => {
    expect(secciones.map((s) => s.titulo)).toEqual([
      'La antijuridicidad', 'Causales de justificación', 'Legítima defensa',
    ])
  })

  it('cada sección trae su texto completo y sin pisarse con la siguiente', () => {
    expect(textoDeSeccion(APUNTE, secciones[1])).toContain('artículo 10')
    expect(textoDeSeccion(APUNTE, secciones[1])).not.toContain('agresión ilegítima')
    expect(secciones[0].fin).toBe(secciones[1].inicio)
  })

  it('empieza sin ninguna sección cubierta', () => {
    expect(secciones.every((s) => !s.cubierta)).toBe(true)
  })

  it('si el apunte no tiene títulos, igual lo parte en pedazos parejos', () => {
    const corrido = 'Una frase cualquiera sin ningún título. '.repeat(400)
    const partes = detectarSecciones(corrido)
    expect(partes.length).toBeGreaterThan(1)
    expect(partes[0].titulo).toMatch(/Parte 1|Todo el apunte/)
    expect(partes[partes.length - 1].fin).toBe(corrido.length)
  })

  it('un apunte corto es una sola sección', () => {
    const partes = detectarSecciones('Texto muy corto, sin títulos ni nada.')
    expect(partes).toHaveLength(1)
  })
})

describe('alcance: qué materia es tuya', () => {
  const secciones = detectarSecciones(APUNTE)

  it('lo que el curso no ha pasado queda fuera', () => {
    const alcance = calcularAlcance([fuente(secciones, 0)])
    expect(estadoDeItem(item('a', 'La antijuridicidad'), alcance)).toBe('sinPasada')
    expect(estadoDeItem(item('b', 'Legítima defensa'), alcance)).toBe('fueraDeAlcance')
  })

  it('una sección con la pasada hecha deja pasar sus ítems', () => {
    const conPasada = secciones.map((s, i) => (i === 0 ? { ...s, cubierta: true } : s))
    const alcance = calcularAlcance([fuente(conPasada, 1)])
    expect(estadoDeItem(item('a', 'La antijuridicidad'), alcance)).toBe('disponible')
    expect(estadoDeItem(item('b', 'Causales de justificación'), alcance)).toBe('sinPasada')
  })

  it('un ítem sin sección, o de una sección desconocida, nunca se pierde', () => {
    const alcance = calcularAlcance([fuente(secciones, 0)])
    expect(estadoDeItem(item('a'), alcance)).toBe('disponible')
    expect(estadoDeItem(item('b', 'Tema que no está en ningún apunte'), alcance)).toBe('disponible')
  })

  it('separa y cuenta lo que queda fuera', () => {
    const conPasada = secciones.map((s, i) => (i === 0 ? { ...s, cubierta: true } : s))
    const alcance = calcularAlcance([fuente(conPasada, 1)])
    const r = filtrarPorAlcance(
      [dato('1', 'La antijuridicidad'), dato('2', 'Causales de justificación'), dato('3', 'Legítima defensa'), dato('4')],
      alcance,
    )
    expect(r.dentro.map((d) => d.item.id)).toEqual(['1', '4'])
    expect(r.sinPasada).toBe(1)
    expect(r.fuera).toBe(1)
  })
})

describe('la próxima jugada', () => {
  const secciones = detectarSecciones(APUNTE)
  const base = { volcados: [], ajustes: AJUSTES_POR_DEFECTO, ahora: Date.now() }

  it('manda a dar la primera pasada de lo que falta', () => {
    const j = proximaJugada({ ...base, datos: [], fuentes: [fuente(secciones, 1)] })
    expect(j.titulo).toContain('La antijuridicidad')
    expect(j.ruta).toContain('/pasada')
  })

  it('los errores graves mandan sobre todo lo demás', () => {
    const graves = [1, 2, 3].map((n) =>
      dato(String(n), undefined, { totalRepasos: 2, enErrores: true, fallosGraves: 1 }),
    )
    const j = proximaJugada({ ...base, datos: graves, fuentes: [fuente(secciones, 1)] })
    expect(j.ruta).toContain('errores=1')
  })

  it('frena en vez de avanzar cuando el tema anterior quedó flojo', () => {
    const cubierta = secciones.map((s, i) => (i === 0 ? { ...s, cubierta: true } : s))
    const flojos = [1, 2, 3, 4].map((n) =>
      dato(String(n), 'La antijuridicidad', { totalRepasos: 1, enErrores: true }),
    )
    const j = proximaJugada({ ...base, datos: flojos, fuentes: [fuente(cubierta, 1)] })
    expect(j.freno).toBe(true)
    expect(j.titulo).toContain('No avances')
  })

  it('con todo cubierto y al día, propone un volcado', () => {
    const todas = secciones.map((s) => ({ ...s, cubierta: true }))
    const firmes = [1, 2, 3].map((n) =>
      dato(String(n), 'La antijuridicidad', { totalRepasos: 5, intervaloDias: 30, vence: Date.now() + 9e8 }),
    )
    const j = proximaJugada({ ...base, datos: firmes, fuentes: [fuente(todas, 2)] })
    expect(j.ruta).toContain('/volcado')
  })
})
