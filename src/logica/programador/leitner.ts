import type { Nota, Progreso } from '../../datos/tipos'

/** Intervalos en días por caja. */
export const INTERVALOS_LEITNER = [0, 1, 3, 7, 16, 35]

const DIA = 24 * 60 * 60 * 1000

export function programarConLeitner(previo: Progreso, nota: Nota, ahora: number): Progreso {
  let caja = previo.caja
  if (nota === 'laTenia') caja = Math.min(caja + 1, INTERVALOS_LEITNER.length - 1)
  else if (nota === 'meFalto') caja = 0
  // "a medias" deja la caja donde está: repite el mismo intervalo.

  const dias = INTERVALOS_LEITNER[caja]
  const estado: Progreso['estado'] =
    nota === 'meFalto' ? 'reaprendiendo' : caja === 0 ? 'aprendiendo' : 'repaso'

  return {
    ...previo,
    caja,
    intervaloDias: dias,
    transcurridoDias: previo.ultimoRepaso ? (ahora - previo.ultimoRepaso) / DIA : 0,
    estado,
    // Caja 0 significa "hoy mismo, más rato".
    vence: dias === 0 ? ahora + 10 * 60 * 1000 : ahora + dias * DIA,
  }
}
