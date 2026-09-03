import Dexie, { type Table } from 'dexie'
import type {
  Ajustes, Curso, Evaluacion, Fuente, Grabacion, Item, Progreso, Revision, Volcado,
} from './tipos'
import { AJUSTES_POR_DEFECTO } from './tipos'

export class BaseRecitar extends Dexie {
  cursos!: Table<Curso, string>
  items!: Table<Item, string>
  progreso!: Table<Progreso, string>
  revisiones!: Table<Revision, number>
  evaluaciones!: Table<Evaluacion, string>
  grabaciones!: Table<Grabacion, string>
  ajustes!: Table<Ajustes, string>
  fuentes!: Table<Fuente, string>
  volcados!: Table<Volcado, string>

  constructor(nombre = 'recitar') {
    super(nombre)
    this.version(1).stores({
      cursos: 'id, nombre',
      items: 'id, cursoId, bloque, tipo, padreId, [cursoId+bloque], [cursoId+tipo]',
      progreso: 'itemId, cursoId, vence, enErrores, [cursoId+vence], [cursoId+enErrores]',
      revisiones: '++id, itemId, cursoId, fecha, grave, [cursoId+fecha]',
      evaluaciones: 'id, cursoId, fecha',
      grabaciones: 'id, itemId, fecha',
      ajustes: 'id',
    })
    this.version(2).stores({
      fuentes: 'id, cursoId, bloque, creadoEn',
      volcados: 'id, cursoId, bloque, fecha',
    })
  }
}

export const db = new BaseRecitar()

export async function leerAjustes(): Promise<Ajustes> {
  const guardados = await db.ajustes.get('unico')
  return { ...AJUSTES_POR_DEFECTO, ...(guardados ?? {}) }
}

export async function guardarAjustes(cambios: Partial<Ajustes>): Promise<void> {
  const actuales = await leerAjustes()
  await db.ajustes.put({ ...actuales, ...cambios, id: 'unico' })
}

export function nuevoId(prefijo = 'i'): string {
  const azar = Math.random().toString(36).slice(2, 10)
  return `${prefijo}_${Date.now().toString(36)}${azar}`
}
