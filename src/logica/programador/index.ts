import type { Item, Motor, Nota, Progreso } from '../../datos/tipos'
import { programarConFsrs } from './fsrs'
import { INTERVALOS_LEITNER, programarConLeitner } from './leitner'

export { INTERVALOS_LEITNER }

export const MINUTO = 60_000
export const DIA = 24 * 60 * MINUTO

/** Los errores graves vuelven dentro de la misma sesión. */
export const ESPERA_GRAVE_MS = 8 * MINUTO
/** Un fallo normal vuelve un poco después, también hoy. */
export const ESPERA_FALLO_MS = 20 * MINUTO
/** Aciertos seguidos necesarios para salir del registro de errores. */
export const ACIERTOS_PARA_SALIR = 3

export function progresoNuevo(item: Item, ahora = Date.now()): Progreso {
  return {
    itemId: item.id,
    cursoId: item.cursoId,
    bloque: item.bloque,
    tipo: item.tipo,
    estado: 'nuevo',
    vence: ahora,
    estabilidad: 0,
    dificultad: 0,
    intervaloDias: 0,
    transcurridoDias: 0,
    caja: 0,
    repeticiones: 0,
    lapsos: 0,
    aciertosSeguidos: 0,
    totalRepasos: 0,
    totalFallos: 0,
    fallosGraves: 0,
    enErrores: false,
  }
}

export interface Calificacion {
  nota: Nota
  /** Dijo "seguro" y falló. */
  grave: boolean
  /** El padre cae porque falló una repregunta de su cadena. */
  arrastre?: boolean
}

/**
 * Aplica una revisión al progreso: primero el intervalo (según el motor
 * elegido) y después la contabilidad del registro de errores, que es igual
 * para los dos motores.
 */
export function aplicarRevision(
  previo: Progreso,
  calificacion: Calificacion,
  motor: Motor = 'fsrs',
  ahora = Date.now(),
): Progreso {
  const { nota, grave } = calificacion
  const base = motor === 'leitner'
    ? programarConLeitner(previo, nota, ahora)
    : programarConFsrs(previo, nota, ahora)

  const p: Progreso = { ...base }
  p.repeticiones = previo.repeticiones + 1
  p.totalRepasos = previo.totalRepasos + 1
  p.ultimoRepaso = ahora

  if (nota === 'laTenia') {
    p.aciertosSeguidos = previo.aciertosSeguidos + 1
    if (p.aciertosSeguidos >= ACIERTOS_PARA_SALIR) {
      p.enErrores = false
      p.urgente = false
    } else {
      p.enErrores = previo.enErrores
      p.urgente = false
    }
  } else if (nota === 'aMedias') {
    // No es fallo, pero corta la racha: no se sale del registro a medias.
    p.aciertosSeguidos = 0
    p.enErrores = previo.enErrores
    p.urgente = false
  } else {
    p.aciertosSeguidos = 0
    p.totalFallos = previo.totalFallos + 1
    p.lapsos = previo.lapsos + 1
    p.enErrores = true
    p.ultimoFallo = ahora
    if (grave) {
      p.fallosGraves = previo.fallosGraves + 1
      p.urgente = true
      p.vence = ahora + ESPERA_GRAVE_MS
      p.intervaloDias = 0
      // El error grave castiga la dificultad: creía saberlo y no lo sabía.
      p.dificultad = Math.min(10, (p.dificultad || 5) + 1)
    } else {
      p.urgente = true
      p.vence = Math.min(p.vence, ahora + ESPERA_FALLO_MS)
      p.intervaloDias = 0
    }
  }

  return p
}
