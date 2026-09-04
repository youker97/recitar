import { useEffect, useMemo, useRef } from 'react'
import { guardarAjustes } from '../datos/db'
import { useAjustes, useCursoActivo, useCursos, useDatos, useFuentes } from '../datos/hooks'
import { calcularAlcance, filtrarPorAlcance } from '../logica/alcance'
import { contarPendientes } from '../logica/cola'
import { ir } from '../rutas'
import { Escudo } from './Identidad'
import { Icono, type NombreIcono } from './Iconos'

/**
 * El menú lateral, hecho a imagen del de la app de Claude: entra deslizando
 * desde el borde izquierdo, deja ver un trozo de la pantalla de atrás, cada
 * fila lleva su icono, los rótulos son suaves, y abajo flota una barra con el
 * escudo (que lleva a Ajustes, como el avatar de la cuenta) y la acción
 * principal, que allá es "Nuevo chat" y acá es estudiar lo de hoy.
 *
 * Lo único propio: el ramo va DENTRO de cada zona. Con pestañas el ramo era un
 * dato aparte y había que acordarse de mirarlo; acá no se entra a ninguna zona
 * sin decir de cuál, porque el ramo ES el botón. Se acabó el "por qué me sale
 * Civil".
 *
 * Se cierra tocando fuera, deslizando hacia la izquierda, con Escape o al
 * elegir cualquier cosa.
 */

interface Props {
  abierto: boolean
  cerrar: () => void
  ruta: string
}

/** Lo que toca hoy en un ramo, con el mismo criterio de la pantalla Estudiar. */
function pendientesDelCurso(
  datos: ReturnType<typeof useDatos>,
  fuentes: ReturnType<typeof useFuentes>,
  cursoId: string,
  nuevosPorDia: number,
): number {
  const mios = datos.filter((d) => d.item.cursoId === cursoId)
  const alcance = calcularAlcance(fuentes.filter((f) => f.cursoId === cursoId))
  const { dentro } = filtrarPorAlcance(mios, alcance)
  const cuentas = contarPendientes(dentro)
  return cuentas.vencidos + Math.min(cuentas.nuevos, nuevosPorDia)
}

export function Menu({ abierto, cerrar, ruta }: Props) {
  const ajustes = useAjustes()
  const cursos = useCursos()
  const activo = useCursoActivo()
  const datos = useDatos()
  const fuentes = useFuentes()
  const panel = useRef<HTMLDivElement>(null)

  const porRevisar = useMemo(
    () => datos.filter((d) => (d.item.revisar?.length ?? 0) > 0).length,
    [datos],
  )

  const resumen = useMemo(
    () =>
      cursos.map((c) => ({
        curso: c,
        hoy: pendientesDelCurso(datos, fuentes, c.id, ajustes.nuevosPorDia),
        preguntas: datos.filter((d) => d.item.cursoId === c.id).length,
        apuntes: fuentes.filter((f) => f.cursoId === c.id).length,
      })),
    [cursos, datos, fuentes, ajustes.nuevosPorDia],
  )

  const hoyDelActivo = resumen.find((r) => r.curso.id === activo?.id)?.hoy ?? 0

  // Con el menú abierto no se desplaza lo de atrás: si no, se cierra el menú y
  // la pantalla quedó en otra parte.
  useEffect(() => {
    if (!abierto) return
    const previo = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panel.current?.focus()
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrar() }
    window.addEventListener('keydown', alTeclear)
    return () => {
      document.body.style.overflow = previo
      window.removeEventListener('keydown', alTeclear)
    }
  }, [abierto, cerrar])

  function irA(destino: string, cursoId?: string) {
    if (cursoId && cursoId !== ajustes.cursoActivoId) guardarAjustes({ cursoActivoId: cursoId })
    cerrar()
    ir(destino)
  }

  /**
   * Se marca la fila donde estás. Para las zonas por ramo no basta la ruta:
   * si no, con dos ramos se encienden los dos y deja de significar nada.
   */
  function esAqui(r: string, cursoId?: string) {
    return ruta === r && (!cursoId || cursoId === ajustes.cursoActivoId)
  }

  function Fila(
    { icono, destino, cursoId, texto, cuenta, apagada }: {
      icono: NombreIcono
      destino: string
      cursoId?: string
      texto: string
      cuenta?: number
      apagada?: boolean
    },
  ) {
    return (
      <button
        className={`menu-fila${esAqui(destino, cursoId) ? ' menu-fila-activa' : ''}`}
        onClick={() => irA(destino, cursoId)}
      >
        <Icono nombre={icono} />
        <span className="crece">{texto}</span>
        {cuenta !== undefined && (
          <span className={`menu-cuenta numeral${apagada || cuenta === 0 ? ' menu-cuenta-cero' : ''}`}>
            {cuenta}
          </span>
        )}
      </button>
    )
  }

  return (
    <>
      <div
        className={`menu-velo${abierto ? ' menu-velo-visible' : ''}`}
        onClick={cerrar}
        aria-hidden="true"
      />
      <div
        className={`menu${abierto ? ' menu-abierto' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Menú"
        aria-hidden={!abierto}
        tabIndex={-1}
        ref={panel}
      >
        <div className="menu-cabeza">
          <span className="menu-marca">Recitar<span>.</span></span>
        </div>

        <nav className="menu-cuerpo">
          {cursos.length === 0 ? (
            <p className="menu-nota">
              Todavía no hay ningún ramo. Trae un apunte y la app arma el resto.
            </p>
          ) : (
            <>
              <p className="menu-rotulo">Estudiar</p>
              {resumen.map(({ curso, hoy }) => (
                <Fila key={curso.id} icono="estudiar" destino="/" cursoId={curso.id}
                      texto={curso.nombre} cuenta={hoy} />
              ))}

              <p className="menu-rotulo">Preguntas</p>
              {resumen.map(({ curso, preguntas }) => (
                <Fila key={curso.id} icono="preguntas" destino="/material" cursoId={curso.id}
                      texto={curso.nombre} cuenta={preguntas} apagada />
              ))}

              <p className="menu-rotulo">Apuntes</p>
              {resumen.map(({ curso, apuntes }) => (
                <Fila key={curso.id} icono="apuntes" destino="/mapa" cursoId={curso.id}
                      texto={curso.nombre} cuenta={apuntes} apagada />
              ))}

              <p className="menu-rotulo">Cargar la app</p>
              <Fila icono="traer" destino="/importar" texto="Meter un apunte" />
              <Fila icono="escribir" destino="/editor" texto="Escribir una pregunta a mano" />

              <p className="menu-rotulo">Más</p>
              <Fila icono="progreso" destino="/estadisticas" texto="Cómo voy" />
              <Fila icono="apartadas" destino="/revisar" texto="Preguntas apartadas"
                    cuenta={porRevisar > 0 ? porRevisar : undefined} />
              <Fila icono="errores" destino="/errores" texto="Registro de errores" />
              <Fila icono="calendario" destino="/pruebas" texto="Fechas de prueba" />
            </>
          )}
        </nav>

        {/* La barra de abajo, como la de Claude: la cuenta a la izquierda y la
            acción principal en una pastilla. Flota sobre la lista, así queda a
            mano con el pulgar sin importar cuánto se haya desplazado. */}
        <div className="menu-pie">
          <button
            className={`menu-avatar${esAqui('/ajustes') ? ' menu-avatar-activo' : ''}`}
            onClick={() => irA('/ajustes')}
            aria-label="Ajustes"
            title="Ajustes"
          >
            {ajustes.escudo
              ? <img src={ajustes.escudo} alt="" />
              : <Escudo tamano={22} />}
          </button>
          {cursos.length === 0 ? (
            <button className="menu-principal" onClick={() => irA('/importar')}>
              <Icono nombre="traer" /> Meter mi primer apunte
            </button>
          ) : (
            <button className="menu-principal" onClick={() => irA('/estudiar')}>
              <Icono nombre="estudiar" /> Estudiar lo de hoy
              {hoyDelActivo > 0 && <span className="numeral">{hoyDelActivo}</span>}
            </button>
          )}
        </div>
      </div>
    </>
  )
}
