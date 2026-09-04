import { useMemo } from 'react'
import { useAjustes, useCursoActivo, useCursos, useDatos, useFuentes, useRevisiones, useVolcados } from '../datos/hooks'
import { contarPendientes, mazosPorBloque } from '../logica/cola'
import { calcularRacha } from '../logica/racha'
import { calcularAlcance, filtrarPorAlcance } from '../logica/alcance'
import { proximaJugada } from '../logica/siguiente'
import { Racha } from '../componentes/Racha'
import { Adorno } from '../componentes/Identidad'

export function Inicio() {
  const ajustes = useAjustes()
  const cursos = useCursos()
  const curso = useCursoActivo()
  const todosLosDatos = useDatos(curso?.id)
  const fuentes = useFuentes(curso?.id)
  const volcados = useVolcados(curso?.id)

  // Lo que el curso todavía no pasa no entra a las sesiones.
  const alcance = useMemo(() => calcularAlcance(fuentes), [fuentes])
  const { dentro: datos, sinPasada, fuera } = useMemo(
    () => filtrarPorAlcance(todosLosDatos, alcance),
    [todosLosDatos, alcance],
  )
  const jugada = useMemo(
    () => proximaJugada({ datos, fuentes, volcados, ajustes }),
    [datos, fuentes, volcados, ajustes],
  )
  const revisiones = useRevisiones(curso?.id, 400)

  const cuentas = useMemo(() => contarPendientes(datos), [datos])
  const racha = useMemo(
    () => calcularRacha(revisiones, ajustes.metaDiaria),
    [revisiones, ajustes.metaDiaria],
  )
  const mazos = useMemo(() => mazosPorBloque(datos), [datos])
  // Sobre TODOS los datos, no solo los que entran a las sesiones: revisar no
  // es estudiar, y si el alcance los escondiera el número no calzaría con el
  // que dio la entrega.
  const porRevisar = useMemo(
    () => todosLosDatos.filter((d) => (d.item.revisar?.length ?? 0) > 0).length,
    [todosLosDatos],
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
    // Sin curso de ejemplo instalado de fábrica, esta es la primera pantalla
    // que ve alguien. Una sola cosa que hacer.
    return (
      <div>
        <div className="jugada" style={{ marginTop: '1.5rem' }}>
          <span className="jugada-rotulo">Para empezar</span>
          <h2>Trae un apunte tuyo</h2>
          <p>
            Un PDF, un .txt, lo que tengas del ramo. Queda guardado en este teléfono y de ahí
            sale todo lo demás.
          </p>
          <a className="boton boton-fuerte" href="#/importar">Meter mi primer apunte</a>
        </div>

        <section className="seccion">
          <div className="titulo-seccion"><h2>Cómo funciona</h2></div>
          <ol className="pasos">
            <li>
              <strong>Traes el apunte.</strong> La app lo parte en temas sola.
            </li>
            <li>
              <strong>Preparas un tema.</strong> El vocabulario y las preguntas se las pides a
              Claude desde la app: copias un pedido, lo pegas allá, traes la respuesta.
            </li>
            <li>
              <strong>Estudias.</strong> Nunca ves la respuesta antes de producir algo, y lo que
              fallas vuelve solo hasta que deja de fallarse.
            </li>
          </ol>
        </section>

        <Adorno />
      </div>
    )
  }

  const hoy = cuentas.vencidos + Math.min(cuentas.nuevos, ajustes.nuevosPorDia)

  return (
    <div>
      <section className="seccion">
        <div className={`jugada${jugada.freno ? ' jugada-freno' : ''}`}>
          {ajustes.escudo && <img className="jugada-escudo" src={ajustes.escudo} alt="" />}
          <span className="jugada-rotulo">{jugada.freno ? 'Alto' : 'Lo próximo'}</span>
          <h2>{jugada.titulo}</h2>
          <p>{jugada.texto}</p>
          <a className="boton boton-fuerte" href={jugada.ruta}>{jugada.etiqueta}</a>
        </div>
      </section>

      <Racha racha={racha} />

      {(sinPasada > 0 || fuera > 0) && (
        <p className="apunte">
          {sinPasada > 0 && `${sinPasada} ítems esperan su primera pasada. `}
          {fuera > 0 && `${fuera} son de materia que el curso todavía no pasa. `}
          <a href="#/mapa">Ver el mapa</a>
        </p>
      )}

      {porRevisar > 0 && (
        <div className="hoja hoja-aviso">
          <strong>
            {porRevisar} {porRevisar === 1 ? 'ítem' : 'ítems'} para revisar antes de estudiarlos
          </strong>
          <p style={{ margin: '0.3rem 0 0.6rem' }} className="apunte">
            Claude los trajo, pero no están en tu apunte. Pueden ser correctos igual; tu profesor
            evalúa del suyo.
          </p>
          <a className="boton boton-chico boton-guia" href="#/revisar">Revisarlos</a>
        </div>
      )}

      <section className="seccion">
        <div className="titulo-seccion">
          <h2>Qué estudiar</h2>
          <span className="lado numeral">{cuentas.total} en total</span>
        </div>

        {cuentas.total === 0 ? (
          <div className="vacio">
            <p>Todavía no hay preguntas que estudiar.</p>
            <a className="boton boton-fuerte" href="#/mapa">Preparar un tema</a>
          </div>
        ) : (
          <ul className="lista-limpia mazos">
            {errores.length > 0 && (
              <li>
                <a className="mazo mazo-errores" href="#/estudiar?errores=1">
                  <span className="crece">
                    <strong>Mis errores</strong>
                    <span className="apunte">
                      Lo que fallaste{cuentas.graves > 0 ? ` · ${cuentas.graves} graves` : ''}
                    </span>
                  </span>
                  <span className="mazo-cuenta numeral">{errores.length}</span>
                </a>
              </li>
            )}
            {mazos.map((m) => (
              <li key={m.bloque}>
                <a className="mazo" href={`#/estudiar?bloque=${encodeURIComponent(m.bloque)}`}>
                  <span className="crece">
                    <strong>{m.bloque}</strong>
                    <span className="apunte">
                      {m.pendientes === 0
                        ? `Al día · ${m.total} en total`
                        : [
                            m.vencidos > 0 ? `${m.vencidos} para repasar` : '',
                            m.nuevos > 0 ? `${m.nuevos} sin ver` : '',
                          ].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className={`mazo-cuenta numeral${m.pendientes === 0 ? ' mazo-cuenta-cero' : ''}`}>
                    {m.pendientes}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}

        {cuentas.total > 0 && (
          <div className="botonera-columna" style={{ marginTop: '0.75rem' }}>
            <a className="boton boton-ancho" href="#/estudiar">
              {hoy > 0 ? `Estudiarlo todo mezclado (${hoy})` : 'Estudiar igual'}
            </a>
          </div>
        )}
      </section>

      <hr className="filete" />

      <section className="seccion">
        <div className="titulo-seccion">
          <h2>Otras formas de estudiar</h2>
        </div>
        <div className="acciones">
          <a className="accion" href="#/pasada">
            <strong>Primera pasada</strong>
            <span>Para lo que todavía no entiendes: leer un tema y escribirlo sin mirar.</span>
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

      <Adorno />
    </div>
  )
}
