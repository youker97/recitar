import { useMemo, useState } from 'react'
import { db } from '../datos/db'
import { borrarItem, devolverAlEstudio } from '../datos/repos'
import { useCursoActivo, useFuentes, useItems } from '../datos/hooks'
import type { Item } from '../datos/tipos'
import { NOMBRE_TIPO } from '../datos/tipos'
import { resumenDeItem } from '../logica/resumen'
import { presentar } from '../logica/mapa'
import { contiene } from '../logica/comparar'
import { ir } from '../rutas'

/**
 * Lo que hay que mirar antes de estudiarlo.
 *
 * Cuando llega una entrega, la app la compara con el apunte: un modelo trae
 * cosas ciertas que no están en TU texto —una definición de manual, un
 * artículo que se sabe de memoria, una frase "citada" que parafraseó— y tu
 * profesor evalúa del suyo. Eso no se puede decidir solo, pero sí se puede
 * señalar, para no tener que revisar las doscientas.
 */
export function Revisar() {
  const curso = useCursoActivo()
  const items = useItems(curso?.id)
  const fuentes = useFuentes(curso?.id)
  const [abierto, setAbierto] = useState<string | null>(null)

  const pendientes = useMemo(
    () => items.filter((i) => (i.revisar?.length ?? 0) > 0),
    [items],
  )

  /** El apunte del que salió, para poder mirar el texto al lado. */
  function apunteDe(item: Item): string {
    const f = fuentes.find((x) => x.bloque === item.bloque)
    return f?.texto ?? ''
  }

  async function darPorBueno(item: Item) {
    await devolverAlEstudio(item.id)
  }

  async function darTodoPorBueno() {
    if (!window.confirm(`¿Dar por buenos los ${pendientes.length} sin mirarlos?`)) return
    const ahora = Date.now()
    await db.items.bulkPut(pendientes.map(({ revisar, ...i }) => {
      void revisar
      return { ...i, suspendido: false, actualizadoEn: ahora }
    }))
  }

  if (!curso) {
    return <div className="vacio"><p>Primero mete material.</p><a className="boton" href="#/importar">Importar</a></div>
  }

  if (pendientes.length === 0) {
    return (
      <div>
        <div className="titulo-seccion"><h1>Para revisar</h1></div>
        <div className="vacio">
          <p>Nada marcado.</p>
          <p className="apunte">
            Acá llega lo que apartes mientras estudias —el botón “Esta pregunta está mala”, cuando
            tengas la respuesta delante y te suene mal— y lo que la app no encuentre en tu apunte
            al descargar una entrega.
          </p>
          <a className="boton" href="#/mapa">Ir a mis apuntes</a>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="titulo-seccion">
        <h1>Para revisar</h1>
        <span className="lado numeral">{pendientes.length}</span>
      </div>
      <p className="apunte">
        Acá llega lo que apartaste mientras estudiabas y lo que la app no encontró en tu apunte.
        Mira cada uno y decide: si sirve, vuelve al estudio; si no, lo borras.
      </p>

      <ul className="lista-limpia">
        {pendientes.map((item) => {
          const texto = apunteDe(item)
          const desplegado = abierto === item.id
          return (
            <li key={item.id} className="hoja">
              <div className="titulo-seccion" style={{ borderBottom: 0, marginBottom: '0.3rem' }}>
                <span className="etiqueta">{NOMBRE_TIPO[item.tipo]}</span>
                <span className="lado ref">{item.seccion ? presentar(item.seccion) : item.bloque}</span>
              </div>

              <div className="estudio" style={{ fontSize: '1.05rem' }}>{resumenDeItem(item)}</div>

              <ul className="apunte" style={{ margin: '0.5rem 0 0.6rem', paddingLeft: '1.1rem' }}>
                {(item.revisar ?? []).map((m, i) => <li key={i}>{m}</li>)}
              </ul>

              {desplegado && texto && (
                <p className="apunte" style={{ borderLeft: '2px solid var(--linea-fuerte)', paddingLeft: '0.6rem' }}>
                  {contiene(texto, resumenDeItem(item), 0.7)
                    ? 'Algo parecido sí aparece en el apunte: puede ser solo una diferencia de redacción.'
                    : 'No encontré nada parecido en el apunte de esta materia.'}
                </p>
              )}

              <div className="botonera">
                <button type="button" className="boton boton-chico boton-guia" onClick={() => darPorBueno(item)}>
                  {item.suspendido ? 'Está bien, devolverla' : 'Está bien, dejarlo'}
                </button>
                <button type="button" className="boton boton-chico" onClick={() => ir(`/editor?id=${item.id}`)}>
                  Corregirlo
                </button>
                <button
                  type="button"
                  className="boton boton-chico boton-peligro"
                  onClick={() => { if (window.confirm('¿Borrar este ítem?')) borrarItem(item.id) }}
                >
                  Borrarlo
                </button>
                {texto && (
                  <button type="button" className="boton boton-chico" onClick={() => setAbierto(desplegado ? null : item.id)}>
                    {desplegado ? 'Ocultar' : 'Buscar en el apunte'}
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      <div className="botonera seccion">
        <button type="button" className="boton boton-chico" onClick={darTodoPorBueno}>
          Devolver los {pendientes.length} al estudio
        </button>
      </div>
    </div>
  )
}
