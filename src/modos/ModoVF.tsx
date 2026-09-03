import { useState } from 'react'
import type { DatosVF } from '../datos/tipos'
import { ElegirConfianza } from '../componentes/Confianza'
import { Autocalificacion } from '../componentes/Autocalificacion'
import { contarPalabras, revisarJustificacion } from '../logica/corrector'
import { RevisionAutomatica } from '../componentes/RevisionAutomatica'
import { BotonRevelar, Encabezado, Enunciado, Referencia, useFases, type PropsModo } from './comun'

const MINIMO_PALABRAS = 6

export function ModoVF({ item, onListo, enCadena }: PropsModo) {
  const datos = item.datos as DatosVF
  const [eleccion, setEleccion] = useState<boolean | null>(null)
  const [justificacion, setJustificacion] = useState('')
  const { fase, confianza, pedirConfianza, elegirConfianza, calificar } = useFases('vf', onListo)

  const acerto = eleccion === datos.esVerdadera
  const palabras = contarPalabras(justificacion)
  const puede = eleccion !== null && palabras >= MINIMO_PALABRAS

  const motivo = eleccion === null
    ? 'Primero marca verdadero o falso.'
    : `Justifica: te faltan ${MINIMO_PALABRAS - palabras} palabras. Sin justificar no vale.`

  const revision = fase === 'revelado' ? revisarJustificacion(justificacion, datos) : null

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

          <label className="campo">
            <span>Justificación — completa, como la darías en la prueba</span>
            <textarea
              className="serif"
              rows={5}
              value={justificacion}
              onChange={(e) => setJustificacion(e.target.value)}
            />
            <span className="contador">{palabras} palabras</span>
          </label>

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

          {revision && revision.total > 0 && (
            <RevisionAutomatica
              revision={revision}
              titulo="Las ideas que tenía que traer tu justificación"
            />
          )}

          <h3 style={{ marginTop: '1.2rem' }}>La tuya</h3>
          <p className="estudio" style={{ color: 'var(--tinta-suave)' }}>{justificacion}</p>

          <hr className="filete" />
          <Autocalificacion
            confianza={confianza}
            onCalificar={(n) =>
              calificar(n, {
                respuesta: justificacion,
                aciertos: revision?.encontrados,
                total: revision?.total,
              })
            }
          />
        </>
      )}
    </div>
  )
}
