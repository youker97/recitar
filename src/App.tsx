import { useCallback, useEffect, useState } from 'react'
import { useUbicacion } from './rutas'
import { useAjustes, useCursoActivo } from './datos/hooks'
import { borrarElEjemplo } from './datos/limpieza'
import { Inicio } from './pantallas/Inicio'
import { Errores } from './pantallas/Errores'
import { Material } from './pantallas/Material'
import { Editor } from './pantallas/Editor'
import { Evaluaciones } from './pantallas/Evaluaciones'
import { Importar } from './pantallas/Importar'
import { Ajustes as PantallaAjustes } from './pantallas/Ajustes'
import { Estadisticas } from './pantallas/Estadisticas'
import { Ensayo } from './pantallas/Ensayo'
import { Volcado } from './pantallas/Volcado'
import { Pasada } from './pantallas/Pasada'
import { Mapa } from './pantallas/Mapa'
import { Vocabulario } from './pantallas/Vocabulario'
import { Revisar } from './pantallas/Revisar'
import { Sesion } from './modos/Sesion'
import { Escudo } from './componentes/Identidad'
import { Menu } from './componentes/Menu'

/** Cuánto hay que arrastrar el dedo para que cuente como deslizar. */
const ARRASTRE = 45
/** Ancho del borde izquierdo desde donde se abre el menú. */
const BORDE = 24

export default function App() {
  const { ruta } = useUbicacion()
  const ajustes = useAjustes()
  const curso = useCursoActivo()
  const [listo, setListo] = useState(false)
  const [menu, setMenu] = useState(false)

  const cerrarMenu = useCallback(() => setMenu(false), [])

  useEffect(() => {
    borrarElEjemplo().finally(() => setListo(true))
  }, [])

  useEffect(() => {
    document.documentElement.dataset.texto = ajustes.tamanoTexto
  }, [ajustes.tamanoTexto])

  // El tema se resuelve acá y queda en <html data-tema>, así el CSS no tiene
  // que repetir la paleta oscura en dos selectores.
  useEffect(() => {
    const raiz = document.documentElement

    /**
     * La barra de estado del teléfono se pinta con <meta theme-color>, y estaba
     * clavada en el color claro: con el tema oscuro quedaba una franja crema
     * arriba de una app negra. Se deja en el mismo color que la cinta.
     *
     * Se borran las que trae el HTML porque llevan media query y el navegador
     * usa la PRIMERA que calce: agregar otra al final no ganaría.
     */
    const pintarLaBarra = () => {
      for (const vieja of document.querySelectorAll('meta[name="theme-color"]')) vieja.remove()
      const meta = document.createElement('meta')
      meta.name = 'theme-color'
      meta.content = getComputedStyle(raiz).getPropertyValue('--papel-hondo').trim()
      document.head.appendChild(meta)
    }

    if (ajustes.tema !== 'auto') {
      raiz.dataset.tema = ajustes.tema === 'oscuro' ? 'oscuro' : 'claro'
      pintarLaBarra()
      return
    }
    const consulta = window.matchMedia('(prefers-color-scheme: dark)')
    const aplicar = () => {
      raiz.dataset.tema = consulta.matches ? 'oscuro' : 'claro'
      pintarLaBarra()
    }
    aplicar()
    consulta.addEventListener('change', aplicar)
    return () => consulta.removeEventListener('change', aplicar)
  }, [ajustes.tema])

  /**
   * Deslizar desde el borde izquierdo abre el menú; deslizar hacia la
   * izquierda con el menú abierto lo cierra. Si el dedo va más vertical que
   * horizontal se deja pasar: eso es desplazar la página, no abrir nada.
   */
  useEffect(() => {
    let x0 = 0
    let y0 = 0
    let desdeElBorde = false
    let siguiendo = false

    const empezar = (e: TouchEvent) => {
      const t = e.touches[0]
      if (!t) return
      x0 = t.clientX
      y0 = t.clientY
      desdeElBorde = t.clientX <= BORDE
      siguiendo = true
    }
    const mover = (e: TouchEvent) => {
      if (!siguiendo) return
      const t = e.touches[0]
      if (!t) return
      const dx = t.clientX - x0
      const dy = t.clientY - y0
      if (Math.abs(dy) > Math.abs(dx)) {
        siguiendo = false
        return
      }
      if (!menu && desdeElBorde && dx > ARRASTRE) {
        setMenu(true)
        siguiendo = false
      } else if (menu && dx < -ARRASTRE) {
        setMenu(false)
        siguiendo = false
      }
    }
    const terminar = () => { siguiendo = false }

    window.addEventListener('touchstart', empezar, { passive: true })
    window.addEventListener('touchmove', mover, { passive: true })
    window.addEventListener('touchend', terminar, { passive: true })
    window.addEventListener('touchcancel', terminar, { passive: true })
    return () => {
      window.removeEventListener('touchstart', empezar)
      window.removeEventListener('touchmove', mover)
      window.removeEventListener('touchend', terminar)
      window.removeEventListener('touchcancel', terminar)
    }
  }, [menu])

  let pantalla
  switch (ruta) {
    case '/': pantalla = <Inicio />; break
    case '/estudiar': pantalla = <Sesion />; break
    case '/errores': pantalla = <Errores />; break
    case '/ensayo': pantalla = <Ensayo />; break
    case '/volcado': pantalla = <Volcado />; break
    case '/pasada': pantalla = <Pasada />; break
    case '/mapa': pantalla = <Mapa />; break
    case '/vocabulario': pantalla = <Vocabulario />; break
    case '/revisar': pantalla = <Revisar />; break
    case '/material': pantalla = <Material />; break
    case '/editor': pantalla = <Editor />; break
    case '/pruebas': pantalla = <Evaluaciones />; break
    case '/importar': pantalla = <Importar />; break
    case '/estadisticas': pantalla = <Estadisticas />; break
    case '/ajustes': pantalla = <PantallaAjustes />; break
    default:
      pantalla = (
        <div className="vacio">
          <p>Esa pantalla no existe.</p>
          <a className="boton" href="#/">Volver al inicio</a>
        </div>
      )
  }

  const enSesion = ruta === '/estudiar' || ruta === '/ensayo' || ruta === '/volcado' || ruta === '/pasada'

  return (
    <>
      <header className="cinta">
        <div className="cinta-dentro">
          <button
            className="boton-menu"
            onClick={() => setMenu(true)}
            aria-label="Abrir el menú"
            aria-expanded={menu}
          >
            <span aria-hidden="true">☰</span> Menú
          </button>
          <a className="marca" href="#/">
            {ajustes.escudo
              ? <img className="emblema" src={ajustes.escudo} alt="" />
              : <Escudo />}
            Recitar<span>.</span>
          </a>
          {enSesion ? (
            <a className="cinta-salir" href="#/">Salir</a>
          ) : (
            curso && (
              // La chapa del ramo abre el menú, que es donde están todos los
              // ramos: un solo lugar para cambiarlo, no dos.
              <button className="chapa-curso" onClick={() => setMenu(true)} title="Cambiar de ramo">
                <span className="chapa-curso-nombre">{curso.nombre}</span>
                <span aria-hidden="true">▾</span>
              </button>
            )
          )}
        </div>
      </header>
      <Menu abierto={menu} cerrar={cerrarMenu} ruta={ruta} />
      <main className="marco">{listo ? pantalla : <p className="apunte">Abriendo…</p>}</main>
    </>
  )
}
