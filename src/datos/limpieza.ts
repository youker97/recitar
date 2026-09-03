import { db } from './db'

/**
 * Saca el curso de ejemplo de encima.
 *
 * La app venía con un curso "Civil — ejemplo" instalado de fábrica. La idea
 * era poder probarla sin importar nada, y el resultado fue el contrario: era
 * el curso activo, así que el primer apunte que traías se guardaba adentro, y
 * después la app te ofrecía bloques de Civil mientras estudiabas Penal.
 *
 * Esto corre al abrir y limpia lo que quedó instalado. Borra el contenido de
 * ejemplo, no el curso: si dentro hay apuntes tuyos, el curso sobrevive con
 * ellos (y se le puede cambiar el nombre desde Material). Solo se borra el
 * curso si no queda nada adentro.
 *
 * Es idempotente y barato: la segunda vez no encuentra nada que borrar.
 */
export async function borrarElEjemplo(): Promise<void> {
  const items = await db.items.filter((i) => i.origen === 'ejemplo').toArray()
  const apuntes = await db.fuentes
    .filter((f) => f.titulo.startsWith('Apunte de ejemplo'))
    .toArray()
  if (items.length === 0 && apuntes.length === 0) {
    await borrarCursosVacios()
    return
  }

  const ids = items.map((i) => i.id)
  await db.transaction('rw', [db.items, db.progreso, db.revisiones, db.fuentes], async () => {
    await db.items.bulkDelete(ids)
    await db.progreso.bulkDelete(ids)
    for (const id of ids) await db.revisiones.where('itemId').equals(id).delete()
    await db.fuentes.bulkDelete(apuntes.map((f) => f.id))
  })
  await borrarCursosVacios()
}

/** Un curso sin apuntes ni preguntas no es nada: estorba en el selector. */
async function borrarCursosVacios(): Promise<void> {
  for (const curso of await db.cursos.toArray()) {
    const conItems = await db.items.where('cursoId').equals(curso.id).count()
    const conApuntes = await db.fuentes.where('cursoId').equals(curso.id).count()
    const conPruebas = await db.evaluaciones.where('cursoId').equals(curso.id).count()
    if (conItems === 0 && conApuntes === 0 && conPruebas === 0) {
      await db.cursos.delete(curso.id)
    }
  }
}
