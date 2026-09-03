import type { Item, Progreso, TipoItem } from '../datos/tipos'

export interface ItemConProgreso {
  item: Item
  progreso: Progreso
}

export interface FiltroSesion {
  bloques?: string[]
  /** Solo estos ítems, en cualquier estado (lo que no salió en un volcado). */
  soloEstos?: string[]
  tipos?: TipoItem[]
  soloErrores?: boolean
  incluirNuevos?: boolean
  nuevosPorDia?: number
  limite?: number
  /** Con cadena activa, las repreguntas solo salen colgando de su padre. */
  cadenaActiva?: boolean
  ahora?: number
}

function prioridad(p: Progreso, ahora: number): number {
  // Más alto = va antes.
  if (p.urgente) return 1_000_000 + (ahora - p.vence) / 1000
  if (p.estado === 'nuevo' && p.totalRepasos === 0) return 1
  const atraso = (ahora - p.vence) / 1000
  const castigoErrores = p.enErrores ? 100_000 : 0
  const castigoGraves = p.fallosGraves * 20_000
  return 10_000 + atraso / 60 + castigoErrores + castigoGraves
}

/**
 * Reordena evitando dos seguidos del mismo bloque y del mismo tipo.
 * Respeta la prioridad todo lo que puede: solo se salta un ítem cuando
 * repetiría bloque o tipo y hay alternativa más abajo.
 */
export function intercalar<T>(
  elementos: T[],
  bloqueDe: (x: T) => string,
  tipoDe: (x: T) => string,
): T[] {
  const restantes = [...elementos]
  const salida: T[] = []
  let ultimoBloque: string | null = null
  let ultimoTipo: string | null = null

  while (restantes.length > 0) {
    let elegido = restantes.findIndex(
      (x) => bloqueDe(x) !== ultimoBloque && tipoDe(x) !== ultimoTipo,
    )
    if (elegido === -1) elegido = restantes.findIndex((x) => bloqueDe(x) !== ultimoBloque)
    if (elegido === -1) elegido = restantes.findIndex((x) => tipoDe(x) !== ultimoTipo)
    if (elegido === -1) elegido = 0

    const [x] = restantes.splice(elegido, 1)
    salida.push(x)
    ultimoBloque = bloqueDe(x)
    ultimoTipo = tipoDe(x)
  }
  return salida
}

export function armarCola(datos: ItemConProgreso[], filtro: FiltroSesion = {}): ItemConProgreso[] {
  const ahora = filtro.ahora ?? Date.now()
  const cadenaActiva = filtro.cadenaActiva ?? true
  const nuevosPorDia = filtro.nuevosPorDia ?? 20
  const incluirNuevos = filtro.incluirNuevos ?? true

  const soloEstos = filtro.soloEstos?.length ? new Set(filtro.soloEstos) : null

  const candidatos = datos.filter(({ item, progreso }) => {
    if (item.suspendido) return false
    // Una lista explícita manda sobre los vencimientos: son los que hay que ver.
    if (soloEstos) return soloEstos.has(item.id)
    // Las repreguntas se lanzan encadenadas, no sueltas.
    if (cadenaActiva && item.padreId) return false
    if (filtro.bloques?.length && !filtro.bloques.includes(item.bloque)) return false
    if (filtro.tipos?.length && !filtro.tipos.includes(item.tipo)) return false
    if (filtro.soloErrores) return progreso.enErrores
    const esNuevo = progreso.totalRepasos === 0
    if (esNuevo) return incluirNuevos
    return progreso.vence <= ahora
  })

  const nuevos = candidatos.filter((c) => c.progreso.totalRepasos === 0)
  const viejos = candidatos.filter((c) => c.progreso.totalRepasos > 0)
  const nuevosRecortados = nuevos.slice(0, Math.max(0, nuevosPorDia))

  const juntos = [...viejos, ...nuevosRecortados].sort(
    (a, b) => prioridad(b.progreso, ahora) - prioridad(a.progreso, ahora),
  )

  const ordenados = intercalar(juntos, (x) => x.item.bloque, (x) => x.item.tipo)
  return filtro.limite ? ordenados.slice(0, filtro.limite) : ordenados
}

/** Cuenta lo que toca hoy, sin armar la cola completa. */
export function contarPendientes(datos: ItemConProgreso[], ahora = Date.now()) {
  let vencidos = 0
  let nuevos = 0
  let errores = 0
  let graves = 0
  for (const { item, progreso } of datos) {
    if (item.suspendido) continue
    if (progreso.enErrores) {
      errores++
      if (progreso.fallosGraves > 0) graves++
    }
    if (progreso.totalRepasos === 0) nuevos++
    else if (progreso.vence <= ahora) vencidos++
  }
  return { vencidos, nuevos, errores, graves, total: datos.length }
}
