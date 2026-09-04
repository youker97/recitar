import { db, leerAjustes, nuevoId } from './db'
import type {
  Confianza, Curso, Evaluacion, Item, ModoEstudio, Nota, Progreso, Revision,
} from './tipos'
import { aplicarRevision, progresoNuevo } from '../logica/programador'
import { esGrave } from '../logica/calificar'
import type { ItemConProgreso } from '../logica/cola'

export async function crearCurso(nombre: string, sigla?: string): Promise<Curso> {
  const ahora = Date.now()
  const curso: Curso = { id: nuevoId('c'), nombre: nombre.trim(), sigla, creadoEn: ahora, actualizadoEn: ahora }
  await db.cursos.add(curso)
  return curso
}

export async function borrarCurso(cursoId: string): Promise<void> {
  await db.transaction('rw', db.cursos, db.items, db.progreso, db.revisiones, db.evaluaciones, async () => {
    const items = await db.items.where('cursoId').equals(cursoId).toArray()
    const ids = items.map((i) => i.id)
    await db.progreso.bulkDelete(ids)
    await db.items.bulkDelete(ids)
    await db.revisiones.where('cursoId').equals(cursoId).delete()
    await db.evaluaciones.where('cursoId').equals(cursoId).delete()
    await db.cursos.delete(cursoId)
  })
}

/** Guarda el ítem y se asegura de que tenga progreso asociado. */
export async function guardarItem(item: Item): Promise<void> {
  await db.transaction('rw', db.items, db.progreso, async () => {
    await db.items.put(item)
    const previo = await db.progreso.get(item.id)
    if (!previo) {
      await db.progreso.put(progresoNuevo(item))
    } else if (previo.bloque !== item.bloque || previo.tipo !== item.tipo) {
      await db.progreso.put({ ...previo, bloque: item.bloque, tipo: item.tipo })
    }
  })
}

export async function guardarItems(items: Item[]): Promise<void> {
  if (items.length === 0) return
  await db.transaction('rw', db.items, db.progreso, async () => {
    await db.items.bulkPut(items)
    const existentes = await db.progreso.bulkGet(items.map((i) => i.id))
    const nuevos: Progreso[] = []
    items.forEach((item, k) => {
      if (!existentes[k]) nuevos.push(progresoNuevo(item))
    })
    if (nuevos.length > 0) await db.progreso.bulkPut(nuevos)
  })
}

export async function borrarItem(id: string): Promise<void> {
  await db.transaction('rw', db.items, db.progreso, db.revisiones, async () => {
    const hijos = await db.items.where('padreId').equals(id).toArray()
    for (const h of hijos) {
      await db.items.delete(h.id)
      await db.progreso.delete(h.id)
    }
    await db.items.delete(id)
    await db.progreso.delete(id)
  })
}

export async function cargarDatos(cursoId?: string): Promise<ItemConProgreso[]> {
  const items = cursoId
    ? await db.items.where('cursoId').equals(cursoId).toArray()
    : await db.items.toArray()
  const progresos = await db.progreso.bulkGet(items.map((i) => i.id))
  const salida: ItemConProgreso[] = []
  const faltantes: Progreso[] = []
  items.forEach((item, k) => {
    let p = progresos[k]
    if (!p) {
      p = progresoNuevo(item)
      faltantes.push(p)
    }
    salida.push({ item, progreso: p })
  })
  if (faltantes.length > 0) await db.progreso.bulkPut(faltantes)
  return salida
}

export interface RespuestaDada {
  item: Item
  modo: ModoEstudio
  confianza: Confianza
  nota: Nota
  duracionMs: number
  respuesta?: string
  aciertos?: number
  total?: number
  cadenaId?: string
  arrastre?: boolean
}

export async function registrarRespuesta(r: RespuestaDada): Promise<Progreso> {
  const ajustes = await leerAjustes()
  const ahora = Date.now()
  const grave = esGrave(r.confianza, r.nota)
  let actualizado: Progreso | undefined

  await db.transaction('rw', db.progreso, db.revisiones, async () => {
    const previo = (await db.progreso.get(r.item.id)) ?? progresoNuevo(r.item, ahora)
    actualizado = aplicarRevision(previo, { nota: r.nota, grave, arrastre: r.arrastre }, ajustes.motor, ahora)
    await db.progreso.put(actualizado)
    const revision: Revision = {
      itemId: r.item.id,
      cursoId: r.item.cursoId,
      bloque: r.item.bloque,
      tipo: r.item.tipo,
      fecha: ahora,
      modo: r.modo,
      confianza: r.confianza,
      nota: r.nota,
      grave,
      arrastre: r.arrastre,
      duracionMs: r.duracionMs,
      respuesta: r.respuesta,
      aciertos: r.aciertos,
      total: r.total,
      cadenaId: r.cadenaId,
    }
    await db.revisiones.add(revision)
  })

  return actualizado!
}

/**
 * El padre cae porque falló una repregunta de su cadena: no está dominado
 * aunque la primera respuesta haya salido bien.
 */
export async function arrastrarPadre(padreId: string, cadenaId: string): Promise<void> {
  const ajustes = await leerAjustes()
  const ahora = Date.now()
  const item = await db.items.get(padreId)
  if (!item) return
  await db.transaction('rw', db.progreso, db.revisiones, async () => {
    const previo = (await db.progreso.get(padreId)) ?? progresoNuevo(item, ahora)
    const actualizado = aplicarRevision(previo, { nota: 'aMedias', grave: false, arrastre: true }, ajustes.motor, ahora)
    await db.progreso.put({ ...actualizado, enErrores: true, aciertosSeguidos: 0 })
    await db.revisiones.add({
      itemId: padreId,
      cursoId: item.cursoId,
      bloque: item.bloque,
      tipo: item.tipo,
      fecha: ahora,
      modo: 'vf',
      confianza: 'masOMenos',
      nota: 'aMedias',
      grave: false,
      arrastre: true,
      duracionMs: 0,
      cadenaId,
    })
  })
}

export async function bloquesDe(cursoId: string): Promise<string[]> {
  const items = await db.items.where('cursoId').equals(cursoId).toArray()
  return [...new Set(items.map((i) => i.bloque).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'))
}

export async function guardarEvaluacion(e: Evaluacion): Promise<void> {
  await db.evaluaciones.put(e)
}

export async function borrarEvaluacion(id: string): Promise<void> {
  await db.evaluaciones.delete(id)
}

export async function reiniciarProgreso(cursoId: string): Promise<void> {
  await db.transaction('rw', db.items, db.progreso, db.revisiones, async () => {
    const items = await db.items.where('cursoId').equals(cursoId).toArray()
    await db.progreso.bulkPut(items.map((i) => progresoNuevo(i)))
    await db.revisiones.where('cursoId').equals(cursoId).delete()
  })
}

/**
 * Marcar una pregunta como mala, en el momento en que se ve que lo es.
 *
 * Es la única verificación que sirve de verdad: la que hace el que estudia
 * cuando tiene la respuesta delante y le suena mal. Queda apartada de las
 * sesiones para no seguir estudiando algo equivocado, y aparece en "Para
 * revisar" para corregirla o borrarla con calma.
 */
export async function marcarMala(itemId: string, motivo: string): Promise<void> {
  const item = await db.items.get(itemId)
  if (!item) return
  const previos = item.revisar ?? []
  await db.items.put({
    ...item,
    revisar: previos.includes(motivo) ? previos : [...previos, motivo],
    suspendido: true,
    actualizadoEn: Date.now(),
  })
}

/** Devuelve al estudio una pregunta apartada, ya corregida o dada por buena. */
export async function devolverAlEstudio(itemId: string): Promise<void> {
  const item = await db.items.get(itemId)
  if (!item) return
  const { revisar, ...limpio } = item
  void revisar
  await db.items.put({ ...limpio, suspendido: false, actualizadoEn: Date.now() })
}
