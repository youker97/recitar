import { useMemo } from 'react'
import { useAjustes, useCursoActivo, useCursos, useDatos, useEvaluaciones, useItems, useRevisiones } from '../datos/hooks'
import { guardarAjustes } from '../datos/db'
import { contarPendientes } from '../logica/cola'
import { cargaDeHoy, formatearFecha } from '../logica/plan'
import { generarConsejos } from '../logica/consejos'
import { resumenDeItem } from '../logica/resumen'
import { calcularRacha } from '../logica/racha'
import { prontitudEn } from '../logica/prontitud'
import { dominioGeneral, dominioPorBloque } from '../logica/dominio'
import { Racha } from '../componentes/Racha'
import { ListaDominio } from '../componentes/Dominio'

export function Inicio() {
  const ajustes = useAjustes()
  const cursos = useCursos()
  const curso = useCursoActivo()
  const datos = useDatos(curso?.id)
  const items = useItems(curso?.id)
  const evaluaciones = useEvaluaciones(curso?.id)
  const revisiones = useRevisiones(curso?.id, 400)

  const cuentas = useMemo(() => contarPendientes(datos), [datos])
  const racha = useMemo(
    () => calcularRacha(revisiones, ajustes.metaDiaria),
    [revisiones, ajustes.metaDiaria],
  )
  const bloques = useMemo(() => dominioPorBloque(datos), [datos])
  const general = useMemo(() => dominioGeneral(datos), [datos])
  const plan = useMemo(() => cargaDeHoy(evaluaciones, datos), [evaluaciones, datos])
  const proxima = plan.estados[0]
  const prontitud = useMemo(
    () => (proxima ? prontitudEn(datos, proxima.evaluacion.fecha, proxima.evaluacion.bloques) : null),
    [datos, proxima],
  )
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

      <Racha racha={racha} />

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
        </div>

        <div className="acciones">
          <a className="accion" href="#/pasada">
            <strong>Primera pasada</strong>
            <span>Para lo que todavía no entiendes: predecir, leer y cerrar el texto.</span>
          </a>
          <a className="accion" href="#/volcado">
            <strong>Volcado</strong>
            <span>Hoja en blanco: escribir de memoria todo lo que queda de una materia.</span>
          </a>
          <a className="accion" href="#/ensayo">
            <strong>Ensayo</strong>
            <span>Evaluación completa, sin ver nada hasta el final. La corrige la app.</span>
          </a>
          <a className="accion" href="#/estudiar?oral=1">
            <strong>Sesión oral</strong>
            <span>Responder hablando, con cronómetro y repreguntas encadenadas.</span>
          </a>
        </div>
      </section>

      <hr className="filete" />

      <section className="seccion">
        <div className="titulo-seccion">
          <h2>Cuánto dominas</h2>
          <a className="lado" href="#/estadisticas">{general.porcentaje}% · ver detalle</a>
        </div>
        {bloques.length === 0 ? (
          <p className="apunte">Todavía no hay materias con avance.</p>
        ) : (
          <ListaDominio bloques={bloques} />
        )}
        <p className="apunte" style={{ marginTop: '0.6rem' }}>
          El porcentaje no cuenta lo que viste, sino cuánto aguanta cada cosa antes de que se te
          olvide. Un ítem recién visto casi no suma.
        </p>
      </section>

      {proxima && prontitud && prontitud.enJuego > 0 && (
        <>
          <hr className="filete" />
          <section className="seccion">
            <div className="titulo-seccion">
              <h2>Si la prueba fuera hoy</h2>
              <span className="lado">{proxima.evaluacion.nombre}</span>
            </div>
            <div className="marcador" style={{ paddingTop: '0.5rem' }}>
              <div className="marcador-cifra numeral">{prontitud.esperado}%</div>
              <div className="apunte">
                de la materia que entra la recordarías el día de la prueba
              </div>
            </div>
            <p className="apunte">
              No es cuántas fichas viste: es la probabilidad de acordarte de cada cosa ese día,
              calculada con la curva de olvido.
              {prontitud.sinVer > 0 && ` Hay ${prontitud.sinVer} ítems que nunca has estudiado y cuentan como cero.`}
            </p>
            {prontitud.porBloque.length > 1 && (
              <div className="dominio">
                {prontitud.porBloque.slice(0, 5).map((b) => (
                  <div key={b.bloque} className="dominio-fila">
                    <div className="crece">{b.bloque}</div>
                    <span className="barra" aria-hidden="true">
                      <span style={{ width: `${Math.max(2, b.esperado)}%` }} />
                    </span>
                    <span className="porcentaje">{b.esperado}%</span>
                  </div>
                ))}
              </div>
            )}
            {prontitud.enPeligro.length > 0 && (
              <p style={{ marginTop: '0.75rem' }}>
                <a className="boton boton-chico" href={`#/estudiar?items=${prontitud.enPeligro.slice(0, 40).map((d) => d.item.id).join(',')}`}>
                  Reforzar los {Math.min(40, prontitud.enPeligro.length)} que se van a caer
                </a>
              </p>
            )}
          </section>
        </>
      )}

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
