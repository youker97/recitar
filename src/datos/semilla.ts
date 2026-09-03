import { db, guardarAjustes, nuevoId } from './db'
import { aItems, validarPaquete } from './esquema'
import { guardarItems } from './repos'
import ejemplo from './ejemplo.json'

/**
 * La primera vez que se abre la app se instala un curso de ejemplo, para que
 * se pueda probar sin importar nada. Se borra desde Ajustes.
 */
export async function sembrarSiEstaVacio(): Promise<void> {
  const cuantos = await db.cursos.count()
  if (cuantos > 0) return

  const validado = validarPaquete(ejemplo)
  if (!validado.ok) return

  const ahora = Date.now()
  const cursoId = nuevoId('c')
  await db.cursos.add({
    id: cursoId,
    nombre: validado.curso ?? 'Curso de ejemplo',
    creadoEn: ahora,
    actualizadoEn: ahora,
  })
  await guardarItems(aItems(validado.items, cursoId, 'ejemplo'))
  await guardarAjustes({ cursoActivoId: cursoId })
}
