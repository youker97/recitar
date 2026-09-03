import { useMemo, useState } from 'react'
import type { DatosAlternativas } from '../datos/tipos'
import { ElegirConfianza } from '../componentes/Confianza'
import { Autocalificacion } from '../componentes/Autocalificacion'
import { BotonRevelar, Encabezado, Enunciado, Referencia, useFases, type PropsModo } from './comun'

/** Barajado estable dentro del ítem: no cambia de posición al re-renderizar. */
function barajar<T>(lista: T[], semilla: number): T[] {
  const copia = [...lista]
  let s = semilla || 1
  for (let i = copia.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    const j = s % (i + 1)
    const t = copia[i]; copia[i] = copia[j]; copia[j] = t
  }
  return copia
}

export function ModoAlternativas({ item, onListo, enCadena, vuelta = 0 }: PropsModo) {
  const datos = item.datos as DatosAlternativas
  const [elegida, setElegida] = useState<number | null>(null)
  const { fase, confianza, pedirConfianza, elegirConfianza, calificar } = useFases('alternativas', onListo)

  // Las opciones cambian de orden entre repasos: no se memoriza "era la b".
  const orden = useMemo(() => {
    const semilla = (item.id.charCodeAt(0) || 7) * 31 + vuelta * 17 + item.id.length
    return barajar(datos.opciones.map((_, i) => i), semilla)
  }, [datos.opciones, item.id, vuelta])

  const acerto = elegida === datos.correcta

  return (
    <div>
      <Encabezado item={item} rotulo="Alternativas" enCadena={enCadena} />
      <Enunciado>{datos.pregunta}</Enunciado>

      {fase !== 'revelado' && (
        <div className="opciones seccion">
          {orden.map((indice, posicion) => (
            <button
              key={indice}
              type="button"
              className="opcion"
              aria-pressed={elegida === indice}
              disabled={fase === 'confianza'}
              onClick={() => setElegida(indice)}
            >
              <span>
                <strong>{String.fromCharCode(97 + posicion)})</strong> {datos.opciones[indice]}
              </span>
            </button>
          ))}
        </div>
      )}

      {fase === 'produciendo' && (
        <BotonRevelar
          puede={elegida !== null}
          motivo="Elige una."
          onClick={pedirConfianza}
          texto="Revisar"
        />
      )}

      {fase === 'confianza' && <ElegirConfianza onElegir={elegirConfianza} />}

      {fase === 'revelado' && (
        <>
          <ul className="lista-limpia seccion">
            {orden.map((indice, posicion) => {
              const esCorrecta = indice === datos.correcta
              const esMia = indice === elegida
              return (
                <li
                  key={indice}
                  className="renglon"
                  style={{ color: esCorrecta ? 'var(--verde)' : esMia ? 'var(--rojo)' : undefined }}
                >
                  <span className="crece estudio" style={{ fontSize: '1rem' }}>
                    <strong>{String.fromCharCode(97 + posicion)})</strong> {datos.opciones[indice]}
                  </span>
                  {esCorrecta && <span className="etiqueta">correcta</span>}
                  {esMia && !esCorrecta && <span className="etiqueta etiqueta-grave">la tuya</span>}
                </li>
              )
            })}
          </ul>

          <p className={acerto ? 'verde' : 'rojo'}>
            <strong>{acerto ? 'Correcta.' : 'No era esa.'}</strong>
          </p>
          {datos.explicacion && <p className="estudio">{datos.explicacion}</p>}
          <Referencia item={item} />

          <hr className="filete" />
          <Autocalificacion
            confianza={confianza}
            titulo={acerto ? '¿La sabías o la achuntaste?' : 'Califícate:'}
            onCalificar={(n) =>
              calificar(n, { respuesta: elegida !== null ? datos.opciones[elegida] : undefined })
            }
          />
        </>
      )}
    </div>
  )
}
