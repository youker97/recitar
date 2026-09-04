import { useMemo, useState } from 'react'
import { useCursoActivo, useItems } from '../datos/hooks'
import { borrarItem, guardarItem } from '../datos/repos'
import { resumenDeItem } from '../logica/resumen'
import { NOMBRE_TIPO, type Item } from '../datos/tipos'
import { normalizar } from '../logica/comparar'
import { ir } from '../rutas'

/** Dentro de cada tema, los ítems se agrupan por el subtema del apunte. */
function agruparPorSeccion(lista: Item[]): [string, Item[]][] {
  const mapa = new Map<string, Item[]>()
  for (const item of lista) {
    const clave = item.seccion ?? ''
    const previos = mapa.get(clave) ?? []
    previos.push(item)
    mapa.set(clave, previos)
  }
  return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es'))
}

export function Material() {
  const curso = useCursoActivo()
  const items = useItems(curso?.id)
  const [busqueda, setBusqueda] = useState('')

  const porBloque = useMemo(() => {
    const filtro = normalizar(busqueda)
    const mapa = new Map<string, Item[]>()
    for (const item of items) {
      if (item.padreId) continue
      if (filtro && !normalizar(`${resumenDeItem(item)} ${item.ref} ${item.bloque}`).includes(filtro)) continue
      const lista = mapa.get(item.bloque) ?? []
      lista.push(item)
      mapa.set(item.bloque, lista)
    }
    return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es'))
  }, [items, busqueda])

  const hijosDe = (id: string) => items.filter((i) => i.padreId === id)

  return (
    <div>
      <div className="titulo-seccion">
        <h1>Preguntas</h1>
        <span className="lado numeral">{items.filter((i) => !i.padreId).length}</span>
      </div>
      <p className="apunte">
        Todo lo que hay para estudiar en {curso ? `«${curso.nombre}»` : 'este ramo'}, una por una.
        Para trabajar un tema completo, Apuntes; para traer más, Cargar la app.
      </p>

      <label className="campo">
        <span>Buscar</span>
        <input
          type="text"
          value={busqueda}
          placeholder="Palabra, artículo o bloque"
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </label>

      {porBloque.length === 0 ? (
        <div className="vacio">
          <p>No hay ítems{busqueda ? ' que coincidan' : ' todavía'}.</p>
        </div>
      ) : (
        porBloque.map(([bloque, lista]) => (
          <section key={bloque} className="seccion">
            <div className="titulo-seccion">
              <h2>{bloque}</h2>
              <span className="lado numeral">{lista.length}</span>
            </div>
            <ul className="lista-limpia">
              {agruparPorSeccion(lista).map(([seccion, deLaSeccion]) => (
                <li key={seccion}>
                  {seccion && (
                    <div className="apunte" style={{ marginTop: '0.6rem', fontWeight: 600 }}>
                      {seccion}
                    </div>
                  )}
                  <ul className="lista-limpia">
                    {deLaSeccion.map((item) => {
                const hijos = hijosDe(item.id)
                return (
                  <li key={item.id} className="renglon">
                    <div className="crece">
                      <div className="estudio" style={{ fontSize: '1.02rem' }}>{resumenDeItem(item)}</div>
                      <div className="ref">
                        {[NOMBRE_TIPO[item.tipo], item.ref].filter(Boolean).join(' · ')}
                        {hijos.length > 0 && ` · ${hijos.length} repreguntas`}
                        {item.suspendido && ' · suspendido'}
                      </div>
                    </div>
                    <div className="botonera">
                      <button
                        type="button"
                        className="boton boton-chico"
                        onClick={() => ir(`/editor?id=${item.id}`)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="boton boton-chico"
                        onClick={() => guardarItem({ ...item, suspendido: !item.suspendido, actualizadoEn: Date.now() })}
                      >
                        {item.suspendido ? 'Activar' : 'Suspender'}
                      </button>
                      <button
                        type="button"
                        className="boton boton-chico boton-peligro"
                        onClick={() => {
                          const aviso = hijos.length > 0
                            ? `Se borra el ítem y sus ${hijos.length} repreguntas. ¿Seguro?`
                            : '¿Borrar este ítem?'
                          if (window.confirm(aviso)) borrarItem(item.id)
                        }}
                      >
                        Borrar
                      </button>
                    </div>
                  </li>
                      )
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

    </div>
  )
}
