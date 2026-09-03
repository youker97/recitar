// Racha: días seguidos cumpliendo la meta. Sirve para volver mañana, que es
// lo único que hace funcionar la repetición espaciada.

import type { Revision } from '../datos/tipos'
import { hoyISO } from './plan'

export interface DiaDeRacha {
  fecha: string
  respuestas: number
  cumplido: boolean
}

export interface Racha {
  actual: number
  record: number
  meta: number
  respuestasHoy: number
  hoyCumplido: boolean
  /** Hay racha viva pero hoy todavía no se cumple la meta. */
  enRiesgo: boolean
  /** Del más antiguo al más nuevo, para el calendario. */
  dias: DiaDeRacha[]
}

const DIA = 24 * 60 * 60 * 1000

function fechaISO(ms: number): string {
  return hoyISO(new Date(ms))
}

export function calcularRacha(
  revisiones: Revision[],
  meta: number,
  diasMostrados = 56,
  ahora = new Date(),
): Racha {
  const porDia = new Map<string, number>()
  for (const r of revisiones) {
    const clave = fechaISO(r.fecha)
    porDia.set(clave, (porDia.get(clave) ?? 0) + 1)
  }

  const metaSegura = Math.max(1, meta)
  const cumplio = (iso: string) => (porDia.get(iso) ?? 0) >= metaSegura

  const hoy = hoyISO(ahora)
  const respuestasHoy = porDia.get(hoy) ?? 0
  const hoyCumplido = respuestasHoy >= metaSegura

  // La racha se cuenta hacia atrás: si hoy todavía no cumples, sigue viva
  // mientras ayer sí lo hayas hecho.
  let actual = 0
  const cursor = new Date(ahora)
  if (!hoyCumplido) cursor.setDate(cursor.getDate() - 1)
  while (cumplio(hoyISO(cursor))) {
    actual++
    cursor.setDate(cursor.getDate() - 1)
  }

  // Récord histórico.
  const fechasCumplidas = [...porDia.entries()]
    .filter(([, n]) => n >= metaSegura)
    .map(([iso]) => iso)
    .sort()
  let record = 0
  let seguidos = 0
  let anterior: string | null = null
  for (const iso of fechasCumplidas) {
    if (anterior) {
      const dif = Math.round((new Date(iso).getTime() - new Date(anterior).getTime()) / DIA)
      seguidos = dif === 1 ? seguidos + 1 : 1
    } else {
      seguidos = 1
    }
    record = Math.max(record, seguidos)
    anterior = iso
  }
  record = Math.max(record, actual)

  const dias: DiaDeRacha[] = []
  for (let i = diasMostrados - 1; i >= 0; i--) {
    const f = new Date(ahora.getTime() - i * DIA)
    const iso = hoyISO(f)
    const respuestas = porDia.get(iso) ?? 0
    dias.push({ fecha: iso, respuestas, cumplido: respuestas >= metaSegura })
  }

  return {
    actual,
    record,
    meta: metaSegura,
    respuestasHoy,
    hoyCumplido,
    enRiesgo: actual > 0 && !hoyCumplido,
    dias,
  }
}
