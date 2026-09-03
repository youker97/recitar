import { db, leerAjustes } from '../datos/db'
import type { Ajustes, Curso, Evaluacion, Item, Progreso, Revision } from '../datos/tipos'

export interface Respaldo {
  recitarRespaldo: 1
  fecha: string
  cursos: Curso[]
  items: Item[]
  progreso: Progreso[]
  revisiones: Revision[]
  evaluaciones: Evaluacion[]
  ajustes: Ajustes
}

/** Material + avance, todo en un archivo. Las grabaciones no se incluyen. */
export async function exportarTodo(): Promise<string> {
  const [cursos, items, progreso, revisiones, evaluaciones, ajustes] = await Promise.all([
    db.cursos.toArray(),
    db.items.toArray(),
    db.progreso.toArray(),
    db.revisiones.toArray(),
    db.evaluaciones.toArray(),
    leerAjustes(),
  ])
  const respaldo: Respaldo = {
    recitarRespaldo: 1,
    fecha: new Date().toISOString(),
    cursos, items, progreso, revisiones, evaluaciones, ajustes,
  }
  return JSON.stringify(respaldo, null, 2)
}

export interface ResultadoRestauracion {
  cursos: number
  items: number
  revisiones: number
}

export async function restaurarDesde(texto: string): Promise<ResultadoRestauracion> {
  let bruto: unknown
  try {
    bruto = JSON.parse(texto)
  } catch {
    throw new Error('El archivo no es JSON válido.')
  }
  if (typeof bruto !== 'object' || bruto === null) throw new Error('El archivo no tiene el formato de un respaldo.')
  const r = bruto as Partial<Respaldo>
  if (r.recitarRespaldo !== 1 || !Array.isArray(r.cursos) || !Array.isArray(r.items)) {
    throw new Error('Esto no parece un respaldo de Recitar. Si es un paquete de ítems, impórtalo desde “Importar”.')
  }

  await db.transaction(
    'rw',
    [db.cursos, db.items, db.progreso, db.revisiones, db.evaluaciones, db.ajustes],
    async () => {
      await db.cursos.bulkPut(r.cursos!)
      await db.items.bulkPut(r.items!)
      if (Array.isArray(r.progreso)) await db.progreso.bulkPut(r.progreso)
      if (Array.isArray(r.revisiones)) {
        // Las revisiones traen id autoincremental: se reinsertan tal cual.
        await db.revisiones.bulkPut(r.revisiones)
      }
      if (Array.isArray(r.evaluaciones)) await db.evaluaciones.bulkPut(r.evaluaciones)
      if (r.ajustes) await db.ajustes.put({ ...r.ajustes, id: 'unico' })
    },
  )

  return {
    cursos: r.cursos!.length,
    items: r.items!.length,
    revisiones: Array.isArray(r.revisiones) ? r.revisiones.length : 0,
  }
}

export function descargar(nombre: string, contenido: string, tipo = 'application/json'): void {
  const blob = new Blob([contenido], { type: tipo })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
