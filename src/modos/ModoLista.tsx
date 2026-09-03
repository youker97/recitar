import { useMemo, useState } from 'react'
import type { DatosLista } from '../datos/tipos'
import { compararLista } from '../logica/comparar'
import { ElegirConfianza } from '../componentes/Confianza'
import { Autocalificacion } from '../componentes/Autocalificacion'
import { BotonRevelar, Encabezado, Enunciado, Referencia, useFases, type PropsModo } from './comun'

export function ModoLista({ item, onListo, enCadena }: PropsModo) {
  const datos = item.datos as DatosLista
  const [texto, setTexto] = useState('')
  const [mostrarCuales, setMostrarCuales] = useState(false)
  const { fase, confianza, pedirConfianza, elegirConfianza, calificar } = useFases('lista', onListo)

  const escritas = texto.split('\n').map((l) => l.trim()).filter(Boolean)
  const total = datos.elementos.length

  const resultado = useMemo(
    () => compararLista(escritas, datos.elementos, datos.ordenImporta),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fase, texto],
  )

  const puede = escritas.length > 0

  return (
    <div>
      <Encabezado item={item} rotulo="Lista contada" enCadena={enCadena} />
      <Enunciado>
        {datos.articulo ? `${datos.articulo}: ` : ''}{datos.titulo}
      </Enunciado>
      <p className="apunte">
        Son <strong>{total}</strong>. Escríbelos, uno por línea.
      </p>

      {fase === 'produciendo' && (
        <>
          <label className="campo">
            <span className="oculto-visual">Elementos, uno por línea</span>
            <textarea
              className="serif"
              rows={Math.max(4, total)}
              value={texto}
              autoFocus
              onChange={(e) => setTexto(e.target.value)}
            />
            <span className="contador">
              {escritas.length} de {total} escritos
            </span>
          </label>
          <BotonRevelar
            puede={puede}
            motivo="Escribe al menos uno."
            onClick={pedirConfianza}
            texto="Listo, revisar"
          />
        </>
      )}

      {fase === 'confianza' && <ElegirConfianza onElegir={elegirConfianza} />}

      {fase === 'revelado' && (
        <>
          <hr className="filete" />
          <p className="centrado">
            <span className="cifra">{resultado.aciertos}</span>
            <span className="estudio"> de {total}</span>
          </p>
          {datos.ordenImporta && (
            <p className="apunte centrado">
              {resultado.ordenCorrecto ? 'El orden está bien.' : 'El orden no corresponde.'}
            </p>
          )}

          {!mostrarCuales ? (
            <div className="botonera-columna seccion">
              <p className="apunte centrado">
                Antes de mirar: ¿cuáles crees que te faltaron?
              </p>
              <button type="button" className="boton boton-ancho" onClick={() => setMostrarCuales(true)}>
                Ver cuáles eran
              </button>
            </div>
          ) : (
            <>
              <h3>Los {total}</h3>
              <ol className="estudio">
                {datos.elementos.map((e, i) => {
                  const acertado = resultado.parejas.some((p) => p.indiceEsperado === i)
                  return (
                    <li key={i} className={acertado ? 'verde' : 'rojo'}>
                      {e} {acertado ? '' : <span className="apunte">— te faltó</span>}
                    </li>
                  )
                })}
              </ol>
              {resultado.sobrantes.length > 0 && (
                <>
                  <h3>Escribiste de más</h3>
                  <ul className="estudio">
                    {resultado.sobrantes.map((j) => (
                      <li key={j}>{escritas[j]}</li>
                    ))}
                  </ul>
                </>
              )}
              <Referencia item={item} />
              <hr className="filete" />
              <Autocalificacion
                confianza={confianza}
                onCalificar={(n) =>
                  calificar(n, { respuesta: texto, aciertos: resultado.aciertos, total })
                }
              />
            </>
          )}
        </>
      )}
    </div>
  )
}
