import { useMemo } from 'react'
import { useAjustes, useCursoActivo, useCursos, useDatos, useEvaluaciones, useItems, useRevisiones } from '../datos/hooks'
import { guardarAjustes } from '../datos/db'
import { contarPendientes } from '../logica/cola'
import { cargaDeHoy, formatearFecha } from '../logica/plan'
import { generarConsejos } from '../logica/consejos'
import { resumenDeItem } from '../logica/resumen'

export function Inicio() {
  const ajustes = useAjustes()
  const cursos = useCursos()
  const curso = useCursoActivo()
  const datos = useDatos(curso?.id)
  const items = useItems(curso?.id)
  const evaluaciones = useEvaluaciones(curso?.id)
  const revisiones = useRevisiones(curso?.id, 400)

  const cuentas = useMemo(() => contarPendientes(datos), [datos])
  const plan = useMemo(() => cargaDeHoy(evaluaciones, datos), [evaluaciones, datos])
  const consejos = useMemo(
    () => generarConsejos({ datos, items, revisiones, estados: plan.estados, ajustes }),
    [datos, items, revisiones, plan.estados, ajustes],
  )

  const errores = useMemo(
    () =>
      datos
        .filter((d) => d.progreso.enErrores)
        .sort((a, b) => {
          const graves = b.progreso.fallosGraves - a.progreso.fallosGraves
          if (graves !== 0) return graves
          return b.progreso.totalFallos - a.progreso.totalFallos
        }),
    [datos],
  )

  if (cursos.length === 0) {
    return (
      <div className="vacio">
        <h1>Recitar</h1>
        <p>No hay material todavía.</p>
        <a className="boton boton-fuerte" href="#/importar">Meter material</a>
      </div>
    )
  }

  const hoy = cuentas.vencidos + Math.min(cuentas.nuevos, ajustes.nuevosPorDia)

  return (
    <div>
      {cursos.length > 1 && (
        <label className="campo" style={{ marginTop: '1rem' }}>
          <span>Curso</span>
          <select
            value={curso?.id ?? ''}
            onChange={(e) => guardarAjustes({ cursoActivoId: e.target.value })}
          >
            {cursos.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </label>
      )}

      <section className="seccion">
        <div className="titulo-seccion">
          <h2>Mis errores</h2>
          <span className="lado numeral">
            {errores.length} pendientes{cuentas.graves > 0 ? ` · ${cuentas.graves} graves` : ''}
          </span>
        </div>

        {errores.length === 0 ? (
          <p className="apunte">
            Nada pendiente. Un ítem entra acá cuando lo fallas y sale cuando lo aciertas tres veces
            seguidas.
          </p>
        ) : (
          <>
            <ul className="lista-limpia">
              {errores.slice(0, 5).map(({ item, progreso }) => (
                <li key={item.id} className="renglon">
                  <div className="crece">
                    <div className="estudio" style={{ fontSize: '1rem' }}>{resumenDeItem(item)}</div>
                    <div className="ref">{item.ref || item.bloque}</div>
                  </div>
                  <span className={`etiqueta${progreso.fallosGraves > 0 ? ' etiqueta-grave' : ''}`}>
                    {progreso.fallosGraves > 0 ? `${progreso.fallosGraves} graves` : `${progreso.totalFallos} fallos`}
                  </span>
                </li>
              ))}
            </ul>
            <div className="botonera seccion">
              <a className="boton boton-fuerte" href="#/estudiar?errores=1">Estudiar solo mis errores</a>
              {errores.length > 5 && <a className="boton" href="#/errores">Ver los {errores.length}</a>}
            </div>
          </>
        )}
      </section>

      <hr className="filete" />

      <section className="seccion">
        <div className="titulo-seccion">
          <h2>Hoy</h2>
          <span className="lado numeral">{cuentas.total} ítems en total</span>
        </div>
        <div className="cifras seccion">
          <div><span className="cifra">{hoy}</span><span>toca hoy</span></div>
          <div><span className="cifra">{cuentas.vencidos}</span><span>vencidos</span></div>
          <div><span className="cifra">{cuentas.nuevos}</span><span>sin ver</span></div>
        </div>
        <div className="botonera-columna">
          <a className="boton boton-fuerte boton-ancho" href="#/estudiar">
            {hoy > 0 ? 'Empezar la sesión de hoy' : 'Estudiar igual'}
          </a>
          <a className="boton boton-ancho" href="#/estudiar?oral=1">Sesión oral</a>
        </div>
      </section>

      {plan.estados.length > 0 && (
        <>
          <hr className="filete" />
          <section className="seccion">
            <div className="titulo-seccion">
              <h2>Pruebas</h2>
              <a className="lado" href="#/pruebas">editar</a>
            </div>
            <ul className="lista-limpia">
              {plan.estados.map((e) => (
                <li key={e.evaluacion.id} className="renglon">
                  <div className="crece">
                    <strong>{e.evaluacion.nombre}</strong>
                    <div className="apunte">{formatearFecha(e.evaluacion.fecha)}</div>
                    <div className="apunte">
                      {e.pendientes} por dominar · {e.porDia} al día para llegar
                    </div>
                  </div>
                  <div className="centrado">
                    <div className="cifra">{Math.max(0, e.diasRestantes)}</div>
                    <div className="apunte">días</div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {ajustes.mostrarConsejos && (
        <>
          <hr className="filete" />
          <section className="seccion">
            <div className="titulo-seccion">
              <h2>Qué conviene hacer</h2>
            </div>
            {consejos.map((c) => (
              <div key={c.id} className={`hoja hoja-${c.tono}`}>
                <strong>{c.titulo}</strong>
                <p style={{ margin: '0.35rem 0 0' }}>{c.texto}</p>
                {c.accion && (
                  <p style={{ margin: '0.5rem 0 0' }}>
                    <a className="boton boton-chico" href={c.accion.ruta}>{c.accion.etiqueta}</a>
                  </p>
                )}
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  )
}
