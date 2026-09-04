import { useEffect, useMemo, useRef } from 'react'
import { guardarAjustes } from '../datos/db'
import { useAjustes, useCursos, useDatos, useFuentes } from '../datos/hooks'
import { calcularAlcance, filtrarPorAlcance } from '../logica/alcance'
import { contarPendientes } from '../logica/cola'
import { ir } from '../rutas'
import { Escudo } from './Identidad'

/**
 * El menú lateral, como el de la app de Claude: entra deslizando desde el
 * borde izquierdo, tapa la pantalla con un velo y adentro está TODO lo que la
 * app sabe hacer, agrupado por zonas y con el ramo en cada zona.
 *
 * Por qué así y no con pestañas:
 *
 * - Con pestañas, el ramo era un dato aparte —una chapa arriba a la derecha—
 *   y había que acordarse de mirarlo. Acá no entras a ninguna zona sin decir
 *   de qué ramo, porque el ramo ES el botón. Se acaba el "por qué me sale
 *   Civil".
 * - Cabían cuatro pestañas y la app hace más de cuatro cosas, así que el
 *   resto vivía escondido dentro de Ajustes, que es donde nadie busca
 *   "escribir una pregunta".
 *
 * Se cierra tocando el velo, deslizando hacia la izquierda, con Escape o al
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
  const activa = (r: string, cursoId?: string) => {
    const aqui = ruta === r && (!cursoId || cursoId === ajustes.cursoActivoId)
    return aqui ? 'menu-fila menu-fila-activa' : 'menu-fila'
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
          <span className="marca">
            {ajustes.escudo
              ? <img className="emblema" src={ajustes.escudo} alt="" />
              : <Escudo />}
            Recitar<span>.</span>
          </span>
          <button className="menu-cerrar" onClick={cerrar} aria-label="Cerrar el menú">✕</button>
        </div>

        <nav className="menu-cuerpo">
          {cursos.length === 0 ? (
            <>
              <p className="menu-nota">
                Todavía no hay ningún ramo. Trae un apunte y la app arma el resto.
              </p>
              <button className="menu-fila menu-fila-fuerte" onClick={() => irA('/importar')}>
                <span className="crece">Meter mi primer apunte</span>
              </button>
            </>
          ) : (
            <>
              <p className="menu-rotulo">Estudiar</p>
              {resumen.map(({ curso, hoy }) => (
                <button
                  key={curso.id}
                  className={activa('/', curso.id)}
                  onClick={() => irA('/', curso.id)}
                >
                  <span className="crece">{curso.nombre}</span>
                  <span className={`menu-cuenta numeral${hoy === 0 ? ' menu-cuenta-cero' : ''}`}>
                    {hoy}
                  </span>
                </button>
              ))}

              <p className="menu-rotulo">Preguntas</p>
              {resumen.map(({ curso, preguntas }) => (
                <button
                  key={curso.id}
                  className={activa('/material', curso.id)}
                  onClick={() => irA('/material', curso.id)}
                >
                  <span className="crece">{curso.nombre}</span>
                  <span className="menu-cuenta numeral menu-cuenta-cero">{preguntas}</span>
                </button>
              ))}

              <p className="menu-rotulo">Apuntes</p>
              {resumen.map(({ curso, apuntes }) => (
                <button
                  key={curso.id}
                  className={activa('/mapa', curso.id)}
                  onClick={() => irA('/mapa', curso.id)}
                >
                  <span className="crece">{curso.nombre}</span>
                  <span className="menu-cuenta numeral menu-cuenta-cero">{apuntes}</span>
                </button>
              ))}

              <p className="menu-rotulo">Cargar la app</p>
              <button className={activa('/importar')} onClick={() => irA('/importar')}>
                <span className="crece">Meter un apunte</span>
              </button>
              <button className={activa('/editor')} onClick={() => irA('/editor')}>
                <span className="crece">Escribir una pregunta a mano</span>
              </button>

              <hr className="menu-filete" />

              <button className={activa('/estadisticas')} onClick={() => irA('/estadisticas')}>
                <span className="crece">Cómo voy</span>
              </button>
              <button className={activa('/revisar')} onClick={() => irA('/revisar')}>
                <span className="crece">Preguntas apartadas</span>
                {porRevisar > 0 && <span className="menu-cuenta numeral">{porRevisar}</span>}
              </button>
              <button className={activa('/errores')} onClick={() => irA('/errores')}>
                <span className="crece">Registro de errores</span>
              </button>
              <button className={activa('/pruebas')} onClick={() => irA('/pruebas')}>
                <span className="crece">Fechas de prueba</span>
              </button>
              <button className={activa('/ajustes')} onClick={() => irA('/ajustes')}>
                <span className="crece">Ajustes</span>
              </button>
            </>
          )}
        </nav>
      </div>
    </>
  )
}
