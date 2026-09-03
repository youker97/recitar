import { useMemo, useState } from 'react'
import { nuevoId } from '../datos/db'
import { borrarEvaluacion, guardarEvaluacion } from '../datos/repos'
import { useCursoActivo, useDatos, useEvaluaciones, useItems } from '../datos/hooks'
import { estadoDeEvaluacion, formatearFecha, hoyISO } from '../logica/plan'
import type { TipoEvaluacion } from '../datos/tipos'

export function Evaluaciones() {
  const curso = useCursoActivo()
  const datos = useDatos(curso?.id)
  const items = useItems(curso?.id)
  const evaluaciones = useEvaluaciones(curso?.id)

  const bloques = useMemo(
    () => [...new Set(items.map((i) => i.bloque).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')),
    [items],
  )

  const [nombre, setNombre] = useState('')
  const [fecha, setFecha] = useState(hoyISO())
  const [tipo, setTipo] = useState<TipoEvaluacion>('escrita')
  const [elegidos, setElegidos] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  async function agregar() {
    if (!curso) return
    if (!nombre.trim()) { setError('Ponle un nombre a la prueba.'); return }
    if (!fecha) { setError('Falta la fecha.'); return }
    setError(null)
    await guardarEvaluacion({
      id: nuevoId('e'),
      cursoId: curso.id,
      nombre: nombre.trim(),
      fecha,
      bloques: elegidos,
      tipo,
    })
    setNombre('')
    setElegidos([])
  }

  if (!curso) {
    return <div className="vacio"><p>Crea un curso primero.</p><a className="boton" href="#/material">Ir al material</a></div>
  }

  return (
    <div>
      <div className="titulo-seccion">
        <h1>Fechas de prueba</h1>
      </div>
      <p className="apunte">
        Con la fecha y los bloques que entran, la pantalla de inicio reparte la carga en vez de
        dejártela toda para el final.
      </p>

      {evaluaciones.length > 0 && (
        <ul className="lista-limpia seccion">
          {evaluaciones.map((e) => {
            const estado = estadoDeEvaluacion(e, datos)
            return (
              <li key={e.id} className="renglon">
                <div className="crece">
                  <strong>{e.nombre}</strong>
                  <div className="apunte">
                    {formatearFecha(e.fecha)} · {e.tipo === 'ambas' ? 'escrita y oral' : e.tipo}
                  </div>
                  <div className="apunte">
                    {e.bloques.length === 0 ? 'Todos los bloques' : e.bloques.join(' · ')}
                  </div>
                  <div className="apunte">
                    {estado.pasada
                      ? 'Ya pasó'
                      : `${estado.dominados} de ${estado.enJuego} dominados · ${estado.porDia} al día`}
                  </div>
                </div>
                <div className="centrado">
                  <div className="cifra">{estado.pasada ? '—' : estado.diasRestantes}</div>
                  <div className="apunte">días</div>
                  <button
                    type="button"
                    className="boton boton-chico boton-peligro"
                    style={{ marginTop: '0.4rem' }}
                    onClick={() => { if (window.confirm('¿Borrar esta prueba?')) borrarEvaluacion(e.id) }}
                  >
                    Borrar
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <hr className="filete" />
      <section className="seccion">
        <h2>Agregar una prueba</h2>
        {error && <div className="aviso-error">{error}</div>}
        <div className="grilla-dos">
          <label className="campo">
            <span>Nombre</span>
            <input type="text" value={nombre} placeholder="Solemne 2" onChange={(e) => setNombre(e.target.value)} />
          </label>
          <label className="campo">
            <span>Fecha</span>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </label>
        </div>
        <label className="campo">
          <span>Tipo</span>
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoEvaluacion)}>
            <option value="escrita">Escrita</option>
            <option value="oral">Oral</option>
            <option value="ambas">Escrita y oral</option>
          </select>
        </label>

        <fieldset style={{ border: 0, padding: 0, margin: '0 0 1rem' }}>
          <legend className="apunte" style={{ padding: 0 }}>
            Bloques que entran (si no marcas ninguno, entran todos)
          </legend>
          <div className="opciones">
            {bloques.map((b) => (
              <label key={b} className="marca-check" style={{ padding: '0.35rem 0' }}>
                <input
                  type="checkbox"
                  checked={elegidos.includes(b)}
                  onChange={(e) =>
                    setElegidos((prev) => (e.target.checked ? [...prev, b] : prev.filter((x) => x !== b)))
                  }
                />
                {b}
              </label>
            ))}
          </div>
        </fieldset>

        <button type="button" className="boton boton-fuerte" onClick={agregar}>Agregar</button>
      </section>
    </div>
  )
}
