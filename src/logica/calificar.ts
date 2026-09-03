import type { Confianza, Nota } from '../datos/tipos'

/**
 * Error grave: dije que estaba seguro y no lo sabía. Es el peor error que
 * existe para un oral, porque en la prueba lo habría afirmado igual.
 */
export function esGrave(confianza: Confianza, nota: Nota): boolean {
  return confianza === 'seguro' && nota === 'meFalto'
}

export function fueFallo(nota: Nota): boolean {
  return nota === 'meFalto'
}

/** Texto que se muestra justo después de calificar. */
export function comentarioCalificacion(confianza: Confianza, nota: Nota): string | null {
  if (esGrave(confianza, nota)) {
    return 'Error grave: lo diste por sabido. Vuelve en unos minutos.'
  }
  if (confianza === 'adivinando' && nota === 'laTenia') {
    return 'Acertaste adivinando. No cuenta como sabido: vuelve pronto.'
  }
  if (confianza === 'seguro' && nota === 'aMedias') {
    return 'Lo tenías a medias creyendo tenerlo entero. Ojo con ese.'
  }
  return null
}
