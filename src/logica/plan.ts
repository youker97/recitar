import type { Evaluacion, Progreso } from '../datos/tipos'
import type { ItemConProgreso } from './cola'

const DIA = 24 * 60 * 60 * 1000

export function hoyISO(fecha = new Date()): string {
  const y = fecha.getFullYear()
  const m = String(fecha.getMonth() + 1).padStart(2, '0')
  const d = String(fecha.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function desdeISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function diasHasta(iso: string, ahora = new Date()): number {
  const objetivo = desdeISO(iso).getTime()
  const hoy = desdeISO(hoyISO(ahora)).getTime()
  return Math.round((objetivo - hoy) / DIA)
}

export function formatearFecha(iso: string): string {
  const f = desdeISO(iso)
  return f.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })
}

/** Un ítem está dominado cuando ya aguanta una semana y no está en errores. */
export function estaDominado(p: Progreso): boolean {
  if (p.totalRepasos === 0) return false
  if (p.enErrores) return false
  return p.intervaloDias >= 7 || p.caja >= 3
}

export interface EstadoEvaluacion {
  evaluacion: Evaluacion
  diasRestantes: number
  enJuego: number
  dominados: number
  pendientes: number
  /** Cuántos ítems hay que dejar dominados por día para llegar a tiempo. */
  porDia: number
  /** Cuántos de esos tocan hoy (vencidos + nuevos). */
  hoy: number
  apretado: boolean
  pasada: boolean
}

export function estadoDeEvaluacion(
  evaluacion: Evaluacion,
  datos: ItemConProgreso[],
  ahora = new Date(),
): EstadoEvaluacion {
  const enJuego = datos.filter(
    ({ item }) =>
      item.cursoId === evaluacion.cursoId &&
      !item.suspendido &&
      (evaluacion.bloques.length === 0 || evaluacion.bloques.includes(item.bloque)),
  )
  const dominados = enJuego.filter(({ progreso }) => estaDominado(progreso)).length
  const pendientes = enJuego.length - dominados
  const diasRestantes = diasHasta(evaluacion.fecha, ahora)
  const diasUtiles = Math.max(1, diasRestantes)
  const porDia = Math.ceil(pendientes / diasUtiles)
  const ms = ahora.getTime()
  const hoy = enJuego.filter(
    ({ progreso }) => progreso.totalRepasos === 0 || progreso.vence <= ms,
  ).length

  return {
    evaluacion,
    diasRestantes,
    enJuego: enJuego.length,
    dominados,
    pendientes,
    porDia,
    hoy: Math.min(hoy, Math.max(porDia, hoy > 0 ? 1 : 0)) || hoy,
    apretado: diasRestantes >= 0 && porDia > 25,
    pasada: diasRestantes < 0,
  }
}

/** Lo que toca hoy sumando todas las evaluaciones vivas del curso. */
export function cargaDeHoy(
  evaluaciones: Evaluacion[],
  datos: ItemConProgreso[],
  ahora = new Date(),
): { objetivo: number; estados: EstadoEvaluacion[] } {
  const estados = evaluaciones
    .map((e) => estadoDeEvaluacion(e, datos, ahora))
    .filter((e) => !e.pasada)
    .sort((a, b) => a.diasRestantes - b.diasRestantes)
  const objetivo = estados.reduce((suma, e) => suma + e.porDia, 0)
  return { objetivo, estados }
}
