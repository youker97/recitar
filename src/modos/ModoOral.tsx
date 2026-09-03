import { useEffect, useState } from 'react'
import type { DatosDesarrollo, DatosRepregunta } from '../datos/tipos'
import { NOMBRE_NOTA } from '../datos/tipos'
import { Cronometro, useCronometro } from '../componentes/Cronometro'
import { Grabadora } from '../componentes/Grabadora'
import { ElegirConfianza } from '../componentes/Confianza'
import { Autocalificacion } from '../componentes/Autocalificacion'
import { Pauta, sugerirNota } from '../componentes/Pauta'
import { puntosDe } from '../logica/corrector'
import { BotonRevelar, Encabezado, Enunciado, Referencia, useFases, type PropsModo } from './comun'

const MINIMO_MS = 20_000

/** Se responde hablando. La pauta aparece recién al terminar. */
export function ModoOral({
  item,
  ajustes,
  onListo,
  enCadena,
  onGrabacion,
}: PropsModo & { onGrabacion?: (blob: Blob, ms: number) => void }) {
  const esRepregunta = item.tipo === 'repregunta'
  const enunciado = esRepregunta
    ? (item.datos as DatosRepregunta).pregunta
    : (item.datos as DatosDesarrollo).enunciado
  const checklist = esRepregunta ? [] : puntosDe((item.datos as DatosDesarrollo).checklist).map((p) => p.texto)
  const minutos = esRepregunta ? undefined : (item.datos as DatosDesarrollo).minutosSugeridos

  const [marcados, setMarcados] = useState<boolean[]>(() => checklist.map(() => false))
  const reloj = useCronometro(true)
  const { fase, confianza, pedirConfianza, elegirConfianza, calificar } = useFases('oral', onListo)

  useEffect(() => {
    if (fase !== 'produciendo') reloj.detener()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase])

  const minimo = esRepregunta ? 6_000 : MINIMO_MS
  const logrados = marcados.filter(Boolean).length
  const sugerida = sugerirNota(logrados, checklist.length)

  return (
    <div>
      <Encabezado item={item} rotulo="Oral" enCadena={enCadena} />
      <Enunciado>{enunciado}</Enunciado>

      {fase === 'produciendo' && (
        <>
          <p className="apunte">
            En voz alta, entera, como si el profesor estuviera al frente. No la pienses en silencio.
          </p>
          <div className="seccion">
            <Cronometro ms={reloj.ms} sugerido={minutos} />
          </div>
          {ajustes.grabarOral && <Grabadora onBlob={onGrabacion} />}
          <BotonRevelar
            puede={reloj.ms >= minimo}
            motivo="Respóndela completa primero. El botón se activa solo."
            onClick={pedirConfianza}
            texto="Ya la respondí"
          />
        </>
      )}

      {fase === 'confianza' && <ElegirConfianza onElegir={elegirConfianza} />}

      {fase === 'revelado' && (
        <>
          <hr className="filete" />
          {esRepregunta ? (
            <>
              <h3>La respuesta</h3>
              <p className="estudio">{(item.datos as DatosRepregunta).respuesta}</p>
            </>
          ) : (
            <>
              <Pauta
                puntos={checklist}
                marcados={marcados}
                onMarcar={(i, v) => {
                  const copia = [...marcados]
                  copia[i] = v
                  setMarcados(copia)
                }}
                titulo="Tilda solo lo que dijiste en voz alta"
              />
              <p className="apunte">
                Con {logrados} de {checklist.length}, esto es un “{NOMBRE_NOTA[sugerida]}”.
              </p>
            </>
          )}
          <Referencia item={item} />
          <Autocalificacion
            confianza={confianza}
            onCalificar={(n) =>
              calificar(n, {
                aciertos: checklist.length ? logrados : undefined,
                total: checklist.length || undefined,
              })
            }
          />
        </>
      )}
    </div>
  )
}
