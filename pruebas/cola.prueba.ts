import { describe, expect, it } from 'vitest'
import { armarCola, contarPendientes, intercalar, type ItemConProgreso } from '../src/logica/cola'
import { progresoNuevo } from '../src/logica/programador'
import type { Item, TipoItem } from '../src/datos/tipos'

const AHORA = 1_700_000_000_000

function crear(id: string, bloque: string, tipo: TipoItem, padreId?: string): Item {
  return {
    id, cursoId: 'c', bloque, tipo,
    datos: { pregunta: id, esVerdadera: true, justificacion: 'j' },
    ref: '', padreId, origen: 'manual', creadoEn: 0, actualizadoEn: 0,
  }
}

function con(item: Item, cambios: Partial<ItemConProgreso['progreso']> = {}): ItemConProgreso {
  return { item, progreso: { ...progresoNuevo(item, AHORA), ...cambios } }
}

describe('cola de la sesión', () => {
  it('no deja dos seguidos del mismo bloque si puede evitarlo', () => {
    const entrada = [
      { b: 'A', t: 'vf' }, { b: 'A', t: 'vf' }, { b: 'A', t: 'vf' },
      { b: 'B', t: 'lista' }, { b: 'B', t: 'lista' }, { b: 'C', t: 'triaje' },
    ].map((x, i) => ({ id: String(i), ...x }))
    const salida = intercalar(entrada, (x) => x.b, (x) => x.t)
    let repetidos = 0
    for (let i = 1; i < salida.length; i++) if (salida[i].b === salida[i - 1].b) repetidos++
    expect(salida).toHaveLength(entrada.length)
    expect(repetidos).toBeLessThanOrEqual(1)
  })

  it('las repreguntas no salen sueltas cuando la cadena está activa', () => {
    const padre = crear('p', 'A', 'vf')
    const hijo = crear('h', 'A', 'repregunta', 'p')
    const cola = armarCola([con(padre), con(hijo)], { cadenaActiva: true, ahora: AHORA })
    expect(cola.map((c) => c.item.id)).toEqual(['p'])
  })

  it('con la cadena apagada, las repreguntas se estudian sueltas', () => {
    const padre = crear('p', 'A', 'vf')
    const hijo = crear('h', 'A', 'repregunta', 'p')
    const cola = armarCola([con(padre), con(hijo)], { cadenaActiva: false, ahora: AHORA })
    expect(cola).toHaveLength(2)
  })

  it('los errores graves van primero', () => {
    const normal = con(crear('n', 'A', 'vf'), { totalRepasos: 3, vence: AHORA - 1000 })
    const grave = con(crear('g', 'B', 'lista'), {
      totalRepasos: 3, vence: AHORA - 100, enErrores: true, fallosGraves: 2, urgente: true,
    })
    const cola = armarCola([normal, grave], { ahora: AHORA })
    expect(cola[0].item.id).toBe('g')
  })

  it('"solo mis errores" deja fuera lo demás', () => {
    const bueno = con(crear('b', 'A', 'vf'), { totalRepasos: 2, vence: AHORA - 10 })
    const malo = con(crear('m', 'B', 'vf'), { totalRepasos: 2, vence: AHORA - 10, enErrores: true })
    const cola = armarCola([bueno, malo], { soloErrores: true, ahora: AHORA })
    expect(cola.map((c) => c.item.id)).toEqual(['m'])
  })

  it('respeta el tope de ítems nuevos por día', () => {
    const datos = Array.from({ length: 10 }, (_, i) => con(crear(String(i), 'A', 'vf')))
    const cola = armarCola(datos, { nuevosPorDia: 4, ahora: AHORA })
    expect(cola).toHaveLength(4)
  })

  it('no adelanta ítems que todavía no vencen', () => {
    const futuro = con(crear('f', 'A', 'vf'), { totalRepasos: 1, vence: AHORA + 86_400_000 })
    expect(armarCola([futuro], { ahora: AHORA })).toHaveLength(0)
  })

  it('cuenta lo pendiente sin armar la cola', () => {
    const datos = [
      con(crear('1', 'A', 'vf')),
      con(crear('2', 'A', 'vf'), { totalRepasos: 2, vence: AHORA - 5 }),
      con(crear('3', 'B', 'vf'), { totalRepasos: 2, vence: AHORA - 5, enErrores: true, fallosGraves: 1 }),
    ]
    const cuentas = contarPendientes(datos, AHORA)
    expect(cuentas).toMatchObject({ nuevos: 1, vencidos: 2, errores: 1, graves: 1, total: 3 })
  })
})
