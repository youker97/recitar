import { useLiveQuery } from 'dexie-react-hooks'
import { db, leerAjustes } from './db'
import type { Ajustes, Curso, Evaluacion, Fuente, Item, Revision, Volcado } from './tipos'
import { AJUSTES_POR_DEFECTO } from './tipos'
import { cargarDatos } from './repos'
import type { ItemConProgreso } from '../logica/cola'

export function useAjustes(): Ajustes {
  return useLiveQuery(() => leerAjustes(), [], AJUSTES_POR_DEFECTO) ?? AJUSTES_POR_DEFECTO
}

export function useCursos(): Curso[] {
  return useLiveQuery(() => db.cursos.toArray(), [], []) ?? []
}

export function useCursoActivo(): Curso | undefined {
  const ajustes = useAjustes()
  const cursos = useCursos()
  if (cursos.length === 0) return undefined
  return cursos.find((c) => c.id === ajustes.cursoActivoId) ?? cursos[0]
}

export function useDatos(cursoId?: string): ItemConProgreso[] {
  return useLiveQuery(() => cargarDatos(cursoId), [cursoId], []) ?? []
}

export function useItems(cursoId?: string): Item[] {
  return useLiveQuery(
    () => (cursoId ? db.items.where('cursoId').equals(cursoId).toArray() : db.items.toArray()),
    [cursoId],
    [],
  ) ?? []
}

export function useEvaluaciones(cursoId?: string): Evaluacion[] {
  return useLiveQuery(
    async () => {
      const todas = cursoId
        ? await db.evaluaciones.where('cursoId').equals(cursoId).toArray()
        : await db.evaluaciones.toArray()
      return todas.sort((a, b) => a.fecha.localeCompare(b.fecha))
    },
    [cursoId],
    [],
  ) ?? []
}

export function useFuentes(cursoId?: string): Fuente[] {
  return useLiveQuery(
    async () => {
      const todas = cursoId
        ? await db.fuentes.where('cursoId').equals(cursoId).toArray()
        : await db.fuentes.toArray()
      return todas.sort((a, b) => b.creadoEn - a.creadoEn)
    },
    [cursoId],
    [],
  ) ?? []
}

export function useVolcados(cursoId?: string): Volcado[] {
  return useLiveQuery(
    async () => {
      const todos = cursoId
        ? await db.volcados.where('cursoId').equals(cursoId).toArray()
        : await db.volcados.toArray()
      return todos.sort((a, b) => b.fecha - a.fecha)
    },
    [cursoId],
    [],
  ) ?? []
}

export function useRevisiones(cursoId?: string, limite = 500): Revision[] {
  return useLiveQuery(
    async () => {
      const todas = cursoId
        ? await db.revisiones.where('cursoId').equals(cursoId).toArray()
        : await db.revisiones.toArray()
      return todas.sort((a, b) => b.fecha - a.fecha).slice(0, limite)
    },
    [cursoId, limite],
    [],
  ) ?? []
}
