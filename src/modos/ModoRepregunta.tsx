import { useState } from 'react'
import type { DatosRepregunta } from '../datos/tipos'
import { ElegirConfianza } from '../componentes/Confianza'
import { Autocalificacion } from '../componentes/Autocalificacion'
import { BotonRevelar, Encabezado, Enunciado, Referencia, useFases, type PropsModo } from './comun'

/** Repregunta tecleada. La versión hablada la hace ModoOral. */
export function ModoRepregunta({ item, onListo, enCadena }: PropsModo) {
  const datos = item.datos as DatosRepregunta
  const [texto, setTexto] = useState('')
  const { fase, confianza, pedirConfianza, elegirConfianza, calificar } = useFases('oral', onListo)

  return (
    <div>
      <Encabezado item={item} rotulo="Repregunta" enCadena={enCadena} />
      <Enunciado>{datos.pregunta}</Enunciado>

      {fase === 'produciendo' && (
        <>
          <label className="campo">
            <span className="oculto-visual">Tu respuesta</span>
            <textarea
              className="serif"
              rows={4}
              value={texto}
              autoFocus
              onChange={(e) => setTexto(e.target.value)}
            />
          </label>
          <BotonRevelar
            puede={texto.trim().length >= 5}
            motivo="Contesta algo, aunque sea corto."
            onClick={pedirConfianza}
          />
        </>
      )}

      {fase === 'confianza' && <ElegirConfianza onElegir={elegirConfianza} />}

      {fase === 'revelado' && (
        <>
          <hr className="filete" />
          <h3>La respuesta</h3>
          <p className="estudio">{datos.respuesta}</p>
          <Referencia item={item} />
          <h3 style={{ marginTop: '1rem' }}>La tuya</h3>
          <p className="estudio" style={{ color: 'var(--tinta-suave)' }}>{texto}</p>
          <hr className="filete" />
          <Autocalificacion confianza={confianza} onCalificar={(n) => calificar(n, { respuesta: texto })} />
        </>
      )}
    </div>
  )
}
