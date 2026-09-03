import { useMemo, useState } from 'react'
import { db } from '../datos/db'
import { useCursoActivo, useFuentes, useItems } from '../datos/hooks'
import type { Fuente } from '../datos/tipos'
import { mapaDe } from './Pasada'
import { normalizar } from '../logica/comparar'
import { ir } from '../rutas'

/**
 * El mapa: qué trae cada apunte, hasta dónde llegó el curso y qué temas ya
 * tienen su primera pasada. Es donde se le dice a la app dónde vas.
 */
export function Mapa() {
  const curso = useCursoActivo()
  const fuentes = useFuentes(curso?.id)
  const items = useItems(curso?.id)
  const [abierto, setAbierto] = useState<string | null>(null)

  const porSeccion = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const i of items) {
      if (!i.seccion) continue
      const clave = normalizar(i.seccion)
      mapa.set(clave, (mapa.get(clave) ?? 0) + 1)
    }
    return mapa
  }, [items])

  async function marcarHasta(fuente: Fuente, indice: number) {
    await db.fuentes.put({ ...fuente, secciones: mapaDe(fuente), hasta: indice })
  }

  async function alternarCubierta(fuente: Fuente, indice: number) {
    const secciones = mapaDe(fuente).map((s, i) =>
      i === indice ? { ...s, cubierta: !s.cubierta } : s,
    )
    await db.fuentes.put({ ...fuente, secciones, terminada: secciones.every((s) => s.cubierta) })
  }

  if (!curso) {
    return <div className="vacio"><p>Primero mete material.</p><a className="boton" href="#/importar">Importar</a></div>
  }

  return (
    <div>
      <div className="titulo-seccion">
        <h1>Mapa de la materia</h1>
        <span className="lado">{curso.nombre}</span>
      </div>
      <p className="apunte">
        Cada apunte trae sus temas. Marca hasta dónde llegó el curso: lo que viene después existe en
        el archivo pero todavía no es tuyo, así que no aparece en las sesiones.
      </p>

      {fuentes.length === 0 ? (
        <div className="vacio">
          <p>No hay apuntes todavía.</p>
          <a className="boton" href="#/importar">Importar un apunte</a>
        </div>
      ) : (
        fuentes.map((fuente) => {
          const secciones = mapaDe(fuente)
          const tope = Number.isInteger(fuente.hasta) ? fuente.hasta : secciones.length - 1
          const desplegado = abierto === fuente.id || fuentes.length === 1
          return (
            <section key={fuente.id} className="seccion">
              <div className="titulo-seccion">
                <h2>{fuente.titulo}</h2>
                <button
                  type="button"
                  className="boton boton-chico"
                  onClick={() => setAbierto(desplegado ? '' : fuente.id)}
                >
                  {desplegado ? 'Ocultar' : 'Ver temas'}
                </button>
              </div>
              <p className="apunte">
                {fuente.bloque} · {secciones.length} temas ·{' '}
                {secciones.filter((s) => s.cubierta).length} con la pasada hecha
              </p>

              {desplegado && (
                <ul className="lista-limpia">
                  {secciones.map((s, i) => {
                    const dentro = i <= tope
                    const cuantos = porSeccion.get(normalizar(s.titulo)) ?? 0
                    return (
                      <li key={i} className="renglon">
                        <div className="crece">
                          <div className={dentro ? 'estudio' : 'estudio tenue'} style={{ fontSize: '1.02rem' }}>
                            {s.titulo}
                          </div>
                          <div className="apunte">
                            {!dentro
                              ? 'Todavía no entra'
                              : s.cubierta
                                ? 'Pasada hecha'
                                : 'Falta la primera pasada'}
                            {cuantos > 0 && ` · ${cuantos} ítems`}
                          </div>
                        </div>
                        <div className="botonera">
                          {dentro && !s.cubierta && (
                            <button
                              type="button"
                              className="boton boton-chico boton-fuerte"
                              onClick={() => ir(`/pasada?fuente=${fuente.id}`)}
                            >
                              Pasada
                            </button>
                          )}
                          {dentro && (
                            <button
                              type="button"
                              className="boton boton-chico"
                              onClick={() => alternarCubierta(fuente, i)}
                            >
                              {s.cubierta ? 'Marcar sin ver' : 'Ya la sé'}
                            </button>
                          )}
                          <button
                            type="button"
                            className="boton boton-chico"
                            onClick={() => marcarHasta(fuente, i)}
                            aria-pressed={i === tope}
                          >
                            {i === tope ? 'Hasta acá ✓' : 'Hasta acá'}
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          )
        })
      )}
    </div>
  )
}
