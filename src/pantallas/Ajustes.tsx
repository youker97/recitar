import { useState } from 'react'
import { db, guardarAjustes } from '../datos/db'
import { useAjustes, useCursoActivo } from '../datos/hooks'
import { INTERVALOS_LEITNER } from '../logica/programador'
import { exportarTodo, descargar, restaurarDesde } from '../importar/respaldo'
import { aEscudo } from '../logica/imagen'
import { Escudo } from '../componentes/Identidad'

export function Ajustes() {
  const ajustes = useAjustes()
  const curso = useCursoActivo()
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function respaldar() {
    const json = await exportarTodo()
    const fecha = new Date().toISOString().slice(0, 10)
    descargar(`recitar-respaldo-${fecha}.json`, json)
    setMensaje('Respaldo descargado. Guárdalo donde no se te pierda.')
  }

  async function restaurar(archivo: File) {
    setError(null)
    setMensaje(null)
    try {
      const texto = await archivo.text()
      const resultado = await restaurarDesde(texto)
      setMensaje(`Restaurado: ${resultado.cursos} cursos, ${resultado.items} ítems, ${resultado.revisiones} revisiones.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el respaldo.')
    }
  }

  return (
    <div>
      <div className="titulo-seccion"><h1>Ajustes</h1></div>

      {mensaje && <div className="hoja hoja-bien">{mensaje}</div>}
      {error && <div className="aviso-error">{error}</div>}

      <section className="seccion">
        <h2>Ir a</h2>
        <div className="acciones">
          <a className="accion" href="#/pruebas">
            <strong>Fechas de prueba</strong>
            <span>Con la fecha, la app reparte la carga en vez de dejártela toda para el final.</span>
          </a>
          <a className="accion" href="#/errores">
            <strong>Registro de errores</strong>
            <span>Todo lo que has fallado, con cuántas veces y cuáles fueron graves.</span>
          </a>
          <a className="accion" href="#/material">
            <strong>Material</strong>
            <span>Los apuntes y las preguntas de este curso, una por una.</span>
          </a>
          <a className="accion" href="#/importar">
            <strong>Importar</strong>
            <span>Meter apuntes, PDF o preguntas nuevas.</span>
          </a>
        </div>
      </section>

      <hr className="filete" />

      <section className="seccion">
        <h2>Estudio</h2>

        <label className="marca-check" style={{ padding: '0.5rem 0' }}>
          <input
            type="checkbox"
            checked={ajustes.cadenaActiva}
            onChange={(e) => guardarAjustes({ cadenaActiva: e.target.checked })}
          />
          <span>
            <strong>Modo cadena</strong>
            <br />
            <span className="apunte">Después de cada ítem vienen sus repreguntas, sin avisar cuántas.</span>
          </span>
        </label>

        <label className="marca-check" style={{ padding: '0.5rem 0' }}>
          <input
            type="checkbox"
            checked={ajustes.repreguntasHabladas}
            onChange={(e) => guardarAjustes({ repreguntasHabladas: e.target.checked })}
          />
          <span>
            <strong>Repreguntas habladas</strong>
            <br />
            <span className="apunte">Se responden en voz alta con cronómetro. Si lo apagas, se teclean.</span>
          </span>
        </label>

        <label className="marca-check" style={{ padding: '0.5rem 0' }}>
          <input
            type="checkbox"
            checked={ajustes.grabarOral}
            onChange={(e) => guardarAjustes({ grabarOral: e.target.checked })}
          />
          <span>
            <strong>Ofrecer grabación en el modo oral</strong>
            <br />
            <span className="apunte">Si el navegador no deja, la app funciona igual.</span>
          </span>
        </label>

        <label className="marca-check" style={{ padding: '0.5rem 0' }}>
          <input
            type="checkbox"
            checked={ajustes.intentarAntes}
            onChange={(e) => guardarAjustes({ intentarAntes: e.target.checked })}
          />
          <span>
            <strong>Intentar las preguntas antes de leer</strong>
            <br />
            <span className="apunte">
              Fallar una pregunta y recién ahí leer hace que el texto se agarre mejor. Solo aparece
              en los temas que ya tienen preguntas: nunca te va a pedir que adivines de qué va un
              texto que no has visto.
            </span>
          </span>
        </label>

        <label className="marca-check" style={{ padding: '0.5rem 0' }}>
          <input
            type="checkbox"
            checked={ajustes.pasadaProfunda}
            onChange={(e) => guardarAjustes({ pasadaProfunda: e.target.checked })}
          />
          <span>
            <strong>Primera pasada en trozos chicos</strong>
            <br />
            <span className="apunte">
              Por defecto cada paso es un tema completo. Con esto se parte en pedazos de media
              página: se agarra mejor, pero son muchas más vueltas.
            </span>
          </span>
        </label>

        <label className="campo" style={{ marginTop: '1rem' }}>
          <span>Desarrollo, por defecto</span>
          <select
            value={ajustes.varianteDesarrollo}
            onChange={(e) => guardarAjustes({ varianteDesarrollo: e.target.value as 'papel' | 'tecleado' })}
          >
            <option value="papel">En papel (escribo a mano)</option>
            <option value="tecleado">Tecleado</option>
          </select>
        </label>

        <div className="grilla-dos">
          <label className="campo">
            <span>Ítems nuevos por día</span>
            <input
              type="number"
              min={0}
              max={200}
              value={ajustes.nuevosPorDia}
              onChange={(e) => guardarAjustes({ nuevosPorDia: Number(e.target.value) })}
            />
          </label>
          <label className="campo">
            <span>Meta diaria (para la racha)</span>
            <input
              type="number"
              min={1}
              max={200}
              value={ajustes.metaDiaria}
              onChange={(e) => guardarAjustes({ metaDiaria: Number(e.target.value) })}
            />
            <span className="apunte">Cuántas respuestas al día cuentan para no cortar la racha.</span>
          </label>
        </div>
      </section>

      <hr className="filete" />

      <section className="seccion">
        <h2>Repetición espaciada</h2>
        <label className="campo">
          <span>Motor</span>
          <select
            value={ajustes.motor}
            onChange={(e) => guardarAjustes({ motor: e.target.value as 'fsrs' | 'leitner' })}
          >
            <option value="fsrs">FSRS (calcula el intervalo según cómo te fue)</option>
            <option value="leitner">Leitner ({INTERVALOS_LEITNER.join('-')} días)</option>
          </select>
          <span className="apunte">
            Se puede cambiar cuando quieras: el avance no se pierde.
          </span>
        </label>
      </section>

      <hr className="filete" />

      <section className="seccion">
        <h2>Aspecto</h2>
        <label className="campo">
          <span>Tema</span>
          <select
            value={ajustes.tema}
            onChange={(e) => guardarAjustes({ tema: e.target.value as 'auto' | 'claro' | 'oscuro' })}
          >
            <option value="auto">Como el teléfono</option>
            <option value="claro">Claro (papel)</option>
            <option value="oscuro">Oscuro</option>
          </select>
          <span className="apunte">
            Para leer de noche, oscuro; con luz de día, claro se lee mejor.
          </span>
        </label>

        <div className="campo">
          <span>Escudo</span>
          <div className="renglon" style={{ borderBottom: 0, paddingTop: 0 }}>
            {ajustes.escudo
              ? <img className="emblema" src={ajustes.escudo} alt="" style={{ width: 44, height: 44 }} />
              : <Escudo tamano={44} />}
            <div className="crece">
              <span className="apunte">
                Sale en la cinta de arriba y de marca de agua en la tarjeta de hoy. Pon la foto que
                quieras: se guarda en este teléfono, achicada, y no sale a ninguna parte.
              </span>
            </div>
          </div>
          <div className="botonera">
            <label className="boton boton-chico" style={{ cursor: 'pointer' }}>
              {ajustes.escudo ? 'Cambiar la foto' : 'Poner una foto'}
              <input
                type="file"
                accept="image/*"
                className="oculto-visual"
                onChange={async (e) => {
                  const archivo = e.target.files?.[0]
                  e.target.value = ''
                  if (!archivo) return
                  setError(null)
                  try {
                    await guardarAjustes({ escudo: await aEscudo(archivo) })
                    setMensaje('Escudo guardado.')
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'No se pudo usar esa imagen.')
                  }
                }}
              />
            </label>
            {ajustes.escudo && (
              <button
                type="button"
                className="boton boton-chico boton-peligro"
                onClick={() => guardarAjustes({ escudo: undefined })}
              >
                Sacarla
              </button>
            )}
          </div>
        </div>

        <label className="campo">
          <span>Tamaño del texto</span>
          <select
            value={ajustes.tamanoTexto}
            onChange={(e) => guardarAjustes({ tamanoTexto: e.target.value as 'normal' | 'grande' })}
          >
            <option value="normal">Normal</option>
            <option value="grande">Grande</option>
          </select>
        </label>
        <label className="marca-check" style={{ padding: '0.5rem 0' }}>
          <input
            type="checkbox"
            checked={ajustes.mostrarConsejos}
            onChange={(e) => guardarAjustes({ mostrarConsejos: e.target.checked })}
          />
          <span>Mostrar consejos en la pantalla de inicio</span>
        </label>
      </section>

      <hr className="filete" />

      <section className="seccion">
        <h2>Respaldo</h2>
        <p className="apunte">
          Todo vive en este teléfono o computador. Si borras los datos del navegador, se pierde.
          Exporta cada cierto tiempo: el archivo trae material y avance.
        </p>
        <div className="botonera">
          <button type="button" className="boton boton-fuerte" onClick={respaldar}>
            Exportar todo
          </button>
          <label className="boton">
            Restaurar desde un archivo
            <input
              type="file"
              accept="application/json,.json"
              className="oculto-visual"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) restaurar(f) }}
            />
          </label>
        </div>
      </section>

      <hr className="filete" />

      <section className="seccion">
        <h2>Datos</h2>
        <div className="botonera">
          <button
            type="button"
            className="boton boton-peligro"
            onClick={async () => {
              if (!window.confirm('Se borra TODO: cursos, material, avance y grabaciones. ¿Seguro?')) return
              await db.delete()
              window.location.reload()
            }}
          >
            Borrar todo y empezar de cero
          </button>
        </div>
        {curso && <p className="apunte">Curso activo: {curso.nombre}</p>}
      </section>
    </div>
  )
}
