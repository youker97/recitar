import { useEffect, useState } from 'react'
import type { DatosDesarrollo } from '../datos/tipos'
import { Cronometro, useCronometro } from '../componentes/Cronometro'
import { ElegirConfianza } from '../componentes/Confianza'
import { Autocalificacion } from '../componentes/Autocalificacion'
import { Pauta, sugerirNota } from '../componentes/Pauta'
import { NOMBRE_NOTA } from '../datos/tipos'
import { BotonRevelar, Encabezado, Enunciado, Referencia, useFases, type PropsModo } from './comun'

const MINIMO_PAPEL_MS = 30_000

export function ModoDesarrollo({ item, ajustes, onListo, enCadena }: PropsModo) {
  const datos = item.datos as DatosDesarrollo
  const [variante, setVariante] = useState(ajustes.varianteDesarrollo)
  const [texto, setTexto] = useState('')
  const [marcados, setMarcados] = useState<boolean[]>(() => datos.checklist.map(() => false))
  const reloj = useCronometro(true)
  const modo = variante === 'papel' ? 'desarrolloPapel' : 'desarrolloTecleado'
  const { fase, confianza, pedirConfianza, elegirConfianza, calificar } = useFases(modo, onListo)

  useEffect(() => {
    if (fase !== 'produciendo') reloj.detener()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase])

  const logrados = marcados.filter(Boolean).length
  const sugerida = sugerirNota(logrados, datos.checklist.length)

  const puede =
    variante === 'papel'
      ? reloj.ms >= MINIMO_PAPEL_MS
      : texto.trim().length >= 40

  const motivo =
    variante === 'papel'
      ? 'Escribe en el cuaderno. La pauta aparece cuando lleves al menos medio minuto.'
      : 'Escribe la respuesta: al menos un par de líneas.'

  return (
    <div>
      <Encabezado item={item} rotulo="Desarrollo" enCadena={enCadena} />
      <Enunciado>{datos.enunciado}</Enunciado>

      {fase === 'produciendo' && (
        <>
          <div className="seccion">
            <Cronometro ms={reloj.ms} sugerido={datos.minutosSugeridos} />
          </div>

          {variante === 'papel' ? (
            <>
              <p className="apunte">
                Escribe a mano en el cuaderno. No mires nada. Cuando termines, aprieta abajo y
                aparece la pauta para tildar lo que de verdad escribiste.
              </p>
              <button
                type="button"
                className="boton boton-chico"
                onClick={() => setVariante('tecleado')}
              >
                Mejor lo tecleo
              </button>
            </>
          ) : (
            <>
              <label className="campo">
                <span className="oculto-visual">Tu desarrollo</span>
                <textarea
                  className="serif"
                  rows={12}
                  value={texto}
                  autoFocus
                  onChange={(e) => setTexto(e.target.value)}
                />
                <span className="contador">{texto.trim().split(/\s+/).filter(Boolean).length} palabras</span>
              </label>
              <button
                type="button"
                className="boton boton-chico"
                onClick={() => setVariante('papel')}
              >
                Mejor lo escribo a mano
              </button>
            </>
          )}

          <BotonRevelar puede={puede} motivo={motivo} onClick={pedirConfianza} texto="Terminé" />
        </>
      )}

      {fase === 'confianza' && <ElegirConfianza onElegir={elegirConfianza} />}

      {fase === 'revelado' && (
        <>
          <hr className="filete" />
          <Pauta
            puntos={datos.checklist}
            marcados={marcados}
            onMarcar={(i, v) => {
              const copia = [...marcados]
              copia[i] = v
              setMarcados(copia)
            }}
          />
          <Referencia item={item} />
          <p className="apunte">
            Con {logrados} de {datos.checklist.length} tildados, esto es un “{NOMBRE_NOTA[sugerida]}”.
          </p>
          <Autocalificacion
            confianza={confianza}
            titulo="¿Cómo lo cuentas?"
            onCalificar={(n) =>
              calificar(n, {
                respuesta: variante === 'tecleado' ? texto : undefined,
                aciertos: logrados,
                total: datos.checklist.length,
              })
            }
          />
        </>
      )}
    </div>
  )
}
