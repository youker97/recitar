import { useMemo, useState } from 'react'
import type { DatosConcepto } from '../datos/tipos'
import { ElegirConfianza } from '../componentes/Confianza'
import { Autocalificacion } from '../componentes/Autocalificacion'
import { contarPalabras } from '../logica/corrector'
import { BotonRevelar, Encabezado, Enunciado, Referencia, useFases, type PropsModo } from './comun'

/**
 * Vocabulario. Se estudia en las dos direcciones y con la frase del apunte
 * delante: saber la definición suelta no sirve si después no reconoces la
 * palabra funcionando dentro de un párrafo.
 */
export function ModoConcepto({ item, onListo, enCadena, vuelta = 0 }: PropsModo) {
  const datos = item.datos as DatosConcepto
  const [respuesta, setRespuesta] = useState('')
  const { fase, confianza, pedirConfianza, elegirConfianza, calificar } = useFases('concepto', onListo)

  // Alterna entre "qué significa esto" y "cómo se llama esto".
  const alReves = vuelta % 3 === 2 && datos.definicion.length > 25

  const contextoConHueco = useMemo(() => {
    if (!datos.contexto) return null
    const patron = new RegExp(datos.termino.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    if (!patron.test(datos.contexto)) return datos.contexto
    return datos.contexto.replace(patron, '______')
  }, [datos.contexto, datos.termino])

  return (
    <div>
      <Encabezado item={item} rotulo="Concepto" enCadena={enCadena} />

      {alReves ? (
        <>
          <p className="apunte">¿Cómo se llama esto?</p>
          <Enunciado>{datos.definicion}</Enunciado>
        </>
      ) : (
        <>
          <p className="apunte">¿Qué es, en este ramo?</p>
          <Enunciado>{datos.termino}</Enunciado>
          {fase === 'produciendo' && contextoConHueco && (
            <p className="estudio" style={{ color: 'var(--tinta-suave)' }}>
              «{contextoConHueco}»
            </p>
          )}
        </>
      )}

      {fase === 'produciendo' && (
        <>
          <label className="campo">
            <span>{alReves ? 'El término' : 'Dilo con tus palabras'}</span>
            <textarea
              className="serif"
              rows={alReves ? 2 : 4}
              value={respuesta}
              autoFocus
              onChange={(e) => setRespuesta(e.target.value)}
            />
          </label>
          <BotonRevelar
            puede={alReves ? respuesta.trim().length >= 3 : contarPalabras(respuesta) >= 4}
            motivo="Contesta algo, aunque sea aproximado."
            onClick={pedirConfianza}
          />
        </>
      )}

      {fase === 'confianza' && <ElegirConfianza onElegir={elegirConfianza} />}

      {fase === 'revelado' && (
        <>
          <hr className="filete" />
          <h3>{datos.termino}</h3>
          <p className="estudio">{datos.definicion}</p>
          {datos.contexto && (
            <p className="estudio" style={{ color: 'var(--tinta-suave)' }}>
              En el apunte: «{datos.contexto}»
            </p>
          )}
          <Referencia item={item} />
          {datos.fuente === 'claude' && (
            <p className="apunte">
              Esta definición la dedujo Claude del contexto, no estaba en el apunte. Vale la pena
              contrastarla con tu profesor.
            </p>
          )}

          <h3 style={{ marginTop: '1rem' }}>La tuya</h3>
          <p className="estudio" style={{ color: 'var(--tinta-suave)' }}>{respuesta}</p>

          <hr className="filete" />
          <Autocalificacion confianza={confianza} onCalificar={(n) => calificar(n, { respuesta })} />
        </>
      )}
    </div>
  )
}
