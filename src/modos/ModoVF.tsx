import { useState } from 'react'
import type { DatosVF } from '../datos/tipos'
import { CajaConLimite } from '../componentes/ContadorLineas'
import { ElegirConfianza } from '../componentes/Confianza'
import { Autocalificacion } from '../componentes/Autocalificacion'
import { BotonRevelar, Encabezado, Enunciado, Referencia, useFases, type PropsModo } from './comun'

export function ModoVF({ item, ajustes, onListo, enCadena }: PropsModo) {
  const datos = item.datos as DatosVF
  const [eleccion, setEleccion] = useState<boolean | null>(null)
  const [justificacion, setJustificacion] = useState('')
  const [excedido, setExcedido] = useState(false)
  const { fase, confianza, pedirConfianza, elegirConfianza, calificar } = useFases('vf', onListo)

  const acerto = eleccion === datos.esVerdadera
  const suficiente = justificacion.trim().length >= 10
  const puede = eleccion !== null && suficiente && !excedido

  const motivo = eleccion === null
    ? 'Primero marca verdadero o falso.'
    : !suficiente
      ? 'Escribe la justificación: sin justificar no vale.'
      : excedido
        ? `Te pasaste de ${ajustes.lineasMaxVF} líneas.`
        : undefined

  return (
    <div>
      <Encabezado item={item} rotulo="Verdadero o falso" enCadena={enCadena} />
      <Enunciado>{datos.pregunta}</Enunciado>

      {fase === 'produciendo' && (
        <>
          <div className="opciones opciones-fila seccion">
            <button
              type="button"
              className="opcion"
              aria-pressed={eleccion === true}
              onClick={() => setEleccion(true)}
            >
              <strong>Verdadero</strong>
            </button>
            <button
              type="button"
              className="opcion"
              aria-pressed={eleccion === false}
              onClick={() => setEleccion(false)}
            >
              <strong>Falso</strong>
            </button>
          </div>

          <CajaConLimite
            etiqueta={`Justificación (máximo ${ajustes.lineasMaxVF} líneas)`}
            valor={justificacion}
            onCambiar={setJustificacion}
            limite={ajustes.lineasMaxVF}
            onExcedido={setExcedido}
          />

          <BotonRevelar puede={puede} motivo={motivo} onClick={pedirConfianza} />
        </>
      )}

      {fase === 'confianza' && <ElegirConfianza onElegir={elegirConfianza} />}

      {fase === 'revelado' && (
        <>
          <hr className="filete" />
          <p className={acerto ? 'verde' : 'rojo'}>
            <strong>
              {acerto ? 'Bien: ' : 'No: '}
              es {datos.esVerdadera ? 'verdadero' : 'falso'}
            </strong>
            {!acerto && ` (marcaste ${eleccion ? 'verdadero' : 'falso'})`}
          </p>

          <h3>La justificación correcta</h3>
          <p className="estudio">{datos.justificacion}</p>
          <Referencia item={item} />

          <h3 style={{ marginTop: '1.2rem' }}>La tuya</h3>
          <p className="estudio" style={{ color: 'var(--tinta-suave)' }}>{justificacion}</p>

          <hr className="filete" />
          <Autocalificacion
            confianza={confianza}
            onCalificar={(n) => calificar(n, { respuesta: justificacion })}
          />
        </>
      )}
    </div>
  )
}
