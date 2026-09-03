import { useMemo, useState } from 'react'
import type { DatosTextoLegal } from '../datos/tipos'
import { aciertaHueco, prepararHuecos } from '../logica/huecos'
import { ElegirConfianza } from '../componentes/Confianza'
import { Autocalificacion } from '../componentes/Autocalificacion'
import { BotonRevelar, Encabezado, Referencia, useFases, type PropsModo } from './comun'

export function ModoTextoLegal({ item, onListo, enCadena, vuelta = 0 }: PropsModo) {
  const datos = item.datos as DatosTextoLegal
  const preparado = useMemo(
    () => prepararHuecos(datos.textoLiteral, vuelta),
    [datos.textoLiteral, vuelta],
  )
  const [llenados, setLlenados] = useState<string[]>(() => preparado.huecos.map(() => ''))
  const { fase, confianza, pedirConfianza, elegirConfianza, calificar } = useFases('textoLegal', onListo)

  const aciertos = preparado.huecos.filter((_, k) => aciertaHueco(llenados[k] ?? '', preparado.respuestas[k])).length
  const escritos = llenados.filter((l) => l.trim() !== '').length
  const revelado = fase === 'revelado'

  const posicionDeHueco = new Map<number, number>()
  preparado.huecos.forEach((indice, k) => posicionDeHueco.set(indice, k))

  return (
    <div>
      <Encabezado item={item} rotulo="Texto legal" enCadena={enCadena} />
      <p className="apunte">Artículo {datos.numero} — completa lo que falta.</p>

      <p className="estudio" style={{ lineHeight: 2.2 }}>
        {preparado.trozos.map((trozo, i) => {
          if (!trozo.esPalabra) return <span key={i}>{trozo.texto}</span>
          const k = posicionDeHueco.get(trozo.indicePalabra!)
          if (k === undefined) return <span key={i}>{trozo.texto}</span>
          const correcta = preparado.respuestas[k]
          const bien = aciertaHueco(llenados[k] ?? '', correcta)
          if (revelado) {
            return (
              <span key={i}>
                <span className={bien ? 'hueco hueco-bien' : 'hueco hueco-mal'}>
                  {llenados[k] || '—'}
                </span>
                {!bien && <span className="hueco-correccion"> {correcta}</span>}
              </span>
            )
          }
          return (
            <input
              key={i}
              className="hueco"
              type="text"
              value={llenados[k] ?? ''}
              aria-label={`Hueco ${k + 1} de ${preparado.huecos.length}`}
              onChange={(e) => {
                const copia = [...llenados]
                copia[k] = e.target.value
                setLlenados(copia)
              }}
            />
          )
        })}
      </p>

      {fase === 'produciendo' && (
        <>
          <p className="contador">{escritos} de {preparado.huecos.length} huecos llenos</p>
          <BotonRevelar
            puede={escritos === preparado.huecos.length}
            motivo="Llénalos todos, aunque sea con lo que te suene."
            onClick={pedirConfianza}
          />
        </>
      )}

      {fase === 'confianza' && <ElegirConfianza onElegir={elegirConfianza} />}

      {revelado && (
        <>
          <hr className="filete" />
          <p className="centrado">
            <span className="cifra">{aciertos}</span>
            <span className="estudio"> de {preparado.huecos.length}</span>
          </p>
          <Referencia item={item} />
          <Autocalificacion
            confianza={confianza}
            onCalificar={(n) =>
              calificar(n, {
                respuesta: llenados.join(' | '),
                aciertos,
                total: preparado.huecos.length,
              })
            }
          />
        </>
      )}
    </div>
  )
}
