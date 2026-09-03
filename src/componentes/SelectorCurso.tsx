import { guardarAjustes } from '../datos/db'
import { useCursoActivo, useCursos } from '../datos/hooks'

/**
 * El curso activo, en la cinta de arriba y en todas las pantallas.
 *
 * Antes era un dato invisible: vivía en los ajustes, se cambiaba en tres
 * pantallas distintas y las demás actuaban sobre él sin decirlo. Así se llega
 * a la pantalla de Pruebas y aparecen bloques de Civil cuando uno está
 * estudiando Penal, sin ninguna pista de por qué.
 */
export function SelectorCurso() {
  const cursos = useCursos()
  const curso = useCursoActivo()
  if (!curso || cursos.length === 0) return null

  if (cursos.length === 1) {
    return <span className="chapa-curso chapa-curso-fija" title="Curso activo">{curso.nombre}</span>
  }

  return (
    <label className="chapa-curso" title="Cambiar de curso">
      <span className="oculto-visual">Curso activo</span>
      <span className="chapa-curso-nombre">{curso.nombre}</span>
      <span aria-hidden="true">▾</span>
      <select
        value={curso.id}
        onChange={(e) => guardarAjustes({ cursoActivoId: e.target.value })}
      >
        {cursos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
      </select>
    </label>
  )
}
