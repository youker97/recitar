import { useEffect, useState } from 'react'
import { useUbicacion } from './rutas'
import { useAjustes } from './datos/hooks'
import { sembrarSiEstaVacio } from './datos/semilla'
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
import { Sesion } from './modos/Sesion'
import { Escudo } from './componentes/Identidad'

const NAVEGACION = [
  { ruta: '/', texto: 'Hoy' },
  { ruta: '/errores', texto: 'Errores' },
  { ruta: '/mapa', texto: 'Mapa' },
  { ruta: '/material', texto: 'Material' },
  { ruta: '/importar', texto: 'Importar' },
  { ruta: '/pruebas', texto: 'Pruebas' },
  { ruta: '/ajustes', texto: 'Ajustes' },
]

export default function App() {
  const { ruta } = useUbicacion()
  const ajustes = useAjustes()
  const [listo, setListo] = useState(false)

  useEffect(() => {
    sembrarSiEstaVacio().finally(() => setListo(true))
  }, [])

  useEffect(() => {
    document.documentElement.dataset.texto = ajustes.tamanoTexto
  }, [ajustes.tamanoTexto])

  // El tema se resuelve acá y queda en <html data-tema>, así el CSS no tiene
  // que repetir la paleta oscura en dos selectores.
  useEffect(() => {
    const raiz = document.documentElement
    if (ajustes.tema !== 'auto') {
      raiz.dataset.tema = ajustes.tema === 'oscuro' ? 'oscuro' : 'claro'
      return
    }
    const consulta = window.matchMedia('(prefers-color-scheme: dark)')
    const aplicar = () => { raiz.dataset.tema = consulta.matches ? 'oscuro' : 'claro' }
    aplicar()
    consulta.addEventListener('change', aplicar)
    return () => consulta.removeEventListener('change', aplicar)
  }, [ajustes.tema])

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
          <a className="marca" href="#/">
            {ajustes.escudo
              ? <img className="emblema" src={ajustes.escudo} alt="" />
              : <Escudo />}
            Recitar<span>.</span>
          </a>
          {!enSesion && (
            <nav aria-label="Secciones">
              {NAVEGACION.map((n) => (
                <a
                  key={n.ruta}
                  href={`#${n.ruta}`}
                  aria-current={ruta === n.ruta ? 'page' : undefined}
                >
                  {n.texto}
                </a>
              ))}
            </nav>
          )}
          {enSesion && (
            <nav aria-label="Salir">
              <a href="#/">Salir de la sesión</a>
            </nav>
          )}
        </div>
      </header>
      <main className="marco">{listo ? pantalla : <p className="apunte">Abriendo…</p>}</main>
    </>
  )
}
