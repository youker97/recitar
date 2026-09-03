import { useState } from 'react'
import type { DatosTriaje, Verbo } from '../datos/tipos'
import { NOMBRE_VERBO } from '../datos/tipos'
import { ElegirConfianza } from '../componentes/Confianza'
import { Autocalificacion } from '../componentes/Autocalificacion'
import { BotonRevelar, Encabezado, Enunciado, Referencia, useFases, type PropsModo } from './comun'

const VERBOS: Verbo[] = ['definir', 'posturas', 'importancia', 'distinciones']

export function ModoTriaje({ item, onListo, bloques = [], enCadena }: PropsModo) {
  const datos = item.datos as DatosTriaje
  const [bloque, setBloque] = useState<string | null>(null)
  const [verbo, setVerbo] = useState<Verbo | null>(null)
  const { fase, confianza, pedirConfianza, elegirConfianza, calificar } = useFases('triaje', onListo)

  const opcionesBloque = bloques.includes(datos.bloque) ? bloques : [...bloques, datos.bloque]
  const bloqueOk = bloque === datos.bloque
  const verboOk = verbo === datos.verbo
  const acerto = bloqueOk && verboOk

  return (
    <div>
      <Encabezado item={item} rotulo="Triaje" enCadena={enCadena} />
      <p className="apunte">No la respondas. Solo di de qué es y qué te está pidiendo.</p>
      <Enunciado>{datos.enunciado}</Enunciado>

      {fase === 'produciendo' && (
        <>
          <div className="seccion">
            <h3>¿De qué bloque es?</h3>
            <div className="opciones">
              {opcionesBloque.map((b) => (
                <button
                  key={b}
                  type="button"
                  className="opcion"
                  aria-pressed={bloque === b}
                  onClick={() => setBloque(b)}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          <div className="seccion">
            <h3>¿Qué te pide?</h3>
            <div className="opciones">
              {VERBOS.map((v) => (
                <button
                  key={v}
                  type="button"
                  className="opcion"
                  aria-pressed={verbo === v}
                  onClick={() => setVerbo(v)}
                >
                  {NOMBRE_VERBO[v]}
                </button>
              ))}
            </div>
          </div>

          <BotonRevelar
            puede={bloque !== null && verbo !== null}
            motivo="Elige bloque y verbo."
            onClick={pedirConfianza}
            texto="Revisar"
          />
        </>
      )}

      {fase === 'confianza' && <ElegirConfianza onElegir={elegirConfianza} />}

      {fase === 'revelado' && (
        <>
          <hr className="filete" />
          <p className={bloqueOk ? 'verde' : 'rojo'}>
            Bloque: <strong>{datos.bloque}</strong>
            {!bloqueOk && ` — dijiste ${bloque}`}
          </p>
          <p className={verboOk ? 'verde' : 'rojo'}>
            Pide: <strong>{NOMBRE_VERBO[datos.verbo]}</strong>
            {!verboOk && verbo && ` — dijiste ${NOMBRE_VERBO[verbo]}`}
          </p>
          <Referencia item={item} />
          <hr className="filete" />
          <Autocalificacion
            confianza={confianza}
            titulo={acerto ? 'Lo identificaste bien:' : 'Califícate:'}
            onCalificar={(n) => calificar(n, { respuesta: `${bloque} / ${verbo}` })}
          />
        </>
      )}
    </div>
  )
}
