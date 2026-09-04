import { db, guardarAjustes, leerAjustes } from './db'

/**
 * Saca el curso de ejemplo de encima.
 *
 * La app venía con un curso "Civil — ejemplo" instalado de fábrica. La idea
 * era poder probarla sin importar nada, y el resultado fue el contrario: era
 * el curso activo, así que el primer apunte que traías se guardaba adentro, y
 * después la app te ofrecía bloques de Civil mientras estudiabas Penal.
 *
 * Se borra ENTERO, con lo que tenga adentro. La primera versión de esta
 * limpieza lo conservaba cuando encontraba apuntes propios adentro, para no
 * borrar nada ajeno; en la práctica eso dejaba el curso ahí para siempre,
 * llamándose "Civil — ejemplo", que es justo lo que había que sacar. Un
 * apunte se vuelve a subir en un minuto; un curso fantasma molesta todos los
 * días.
 *
 * Corre al abrir la app y es idempotente: la segunda vez no encuentra nada.
 */

/** El nombre exacto con que se instalaba, sin acentos, guiones ni espacios. */
const NOMBRE_DEL_EJEMPLO = 'civilejemplo'

function huella(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

export async function borrarElEjemplo(): Promise<void> {
  const cursos = await db.cursos.toArray()
  for (const curso of cursos) {
    if (huella(curso.nombre) === NOMBRE_DEL_EJEMPLO) await borrarCursoEntero(curso.id)
  }

  // Restos sueltos: contenido de ejemplo que haya quedado en otro curso.
  const items = await db.items.filter((i) => i.origen === 'ejemplo').toArray()
  const apuntes = await db.fuentes
    .filter((f) => f.titulo.startsWith('Apunte de ejemplo'))
    .toArray()
  if (items.length > 0 || apuntes.length > 0) {
    const ids = items.map((i) => i.id)
    await db.transaction('rw', [db.items, db.progreso, db.revisiones, db.fuentes], async () => {
      await db.items.bulkDelete(ids)
      await db.progreso.bulkDelete(ids)
      for (const id of ids) await db.revisiones.where('itemId').equals(id).delete()
      await db.fuentes.bulkDelete(apuntes.map((f) => f.id))
    })
  }

  await borrarCursosVacios()
  await enderezarCursoActivo()
}

/** Borra un curso con todo lo que cuelga de él. */
async function borrarCursoEntero(cursoId: string): Promise<void> {
  const items = await db.items.where('cursoId').equals(cursoId).toArray()
  const ids = items.map((i) => i.id)
  await db.transaction(
    'rw',
    [db.cursos, db.items, db.progreso, db.revisiones, db.fuentes, db.evaluaciones, db.grabaciones],
    async () => {
      await db.items.bulkDelete(ids)
      await db.progreso.bulkDelete(ids)
      for (const id of ids) await db.grabaciones.where('itemId').equals(id).delete()
      await db.revisiones.where('cursoId').equals(cursoId).delete()
      await db.fuentes.where('cursoId').equals(cursoId).delete()
      await db.evaluaciones.where('cursoId').equals(cursoId).delete()
      await db.cursos.delete(cursoId)
    },
  )
}

/** Un día. Menos que eso, el ramo lo acabas de crear. */
const RECIEN = 24 * 60 * 60 * 1000

/**
 * Un curso viejo sin apuntes ni preguntas es un fantasma y estorba.
 *
 * Pero NO se toca uno recién creado ni el que tienes puesto: creas "Procesal
 * III" en Ajustes para meterle el apunte mañana, cierras la app, y al volver
 * ya no está. Eso es peor que el fantasma.
 */
async function borrarCursosVacios(): Promise<void> {
  const ajustes = await leerAjustes()
  const ahora = Date.now()
  for (const curso of await db.cursos.toArray()) {
    if (curso.id === ajustes.cursoActivoId) continue
    if (ahora - curso.creadoEn < RECIEN) continue
    const conItems = await db.items.where('cursoId').equals(curso.id).count()
    const conApuntes = await db.fuentes.where('cursoId').equals(curso.id).count()
    const conPruebas = await db.evaluaciones.where('cursoId').equals(curso.id).count()
    if (conItems === 0 && conApuntes === 0 && conPruebas === 0) {
      await db.cursos.delete(curso.id)
    }
  }
}

/** Si el curso activo era el que se borró, apuntar al que quede. */
async function enderezarCursoActivo(): Promise<void> {
  const ajustes = await leerAjustes()
  if (!ajustes.cursoActivoId) return
  const sigue = await db.cursos.get(ajustes.cursoActivoId)
  if (sigue) return
  const primero = await db.cursos.orderBy('nombre').first()
  await guardarAjustes({ cursoActivoId: primero?.id })
}
