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
import { Sesion } from './modos/Sesion'

const NAVEGACION = [
  { ruta: '/', texto: 'Hoy' },
  { ruta: '/errores', texto: 'Errores' },
  { ruta: '/material', texto: 'Material' },
  { ruta: '/pruebas', texto: 'Pruebas' },
  { ruta: '/importar', texto: 'Importar' },
  { ruta: '/estadisticas', texto: 'Avance' },
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

  let pantalla
  switch (ruta) {
    case '/': pantalla = <Inicio />; break
    case '/estudiar': pantalla = <Sesion />; break
    case '/errores': pantalla = <Errores />; break
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

  const enSesion = ruta === '/estudiar'

  return (
    <>
      <header className="cinta">
        <div className="cinta-dentro">
          <a className="marca" href="#/">Recitar<span>.</span></a>
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
