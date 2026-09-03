import { useState } from 'react'
import type { DatosArticulo } from '../datos/tipos'
import { coincideArticulo, similitud } from '../logica/comparar'
import { ElegirConfianza } from '../componentes/Confianza'
import { Autocalificacion } from '../componentes/Autocalificacion'
import { BotonRevelar, Encabezado, Enunciado, Referencia, useFases, type PropsModo } from './comun'

export function ModoArticulo({
  item,
  onListo,
  enCadena,
  direccion,
}: PropsModo & { direccion: 'numeroAMateria' | 'materiaANumero' }) {
  const datos = item.datos as DatosArticulo
  const [respuesta, setRespuesta] = useState('')
  const modo = direccion === 'numeroAMateria' ? 'articuloNumeroMateria' : 'articuloMateriaNumero'
  const { fase, confianza, pedirConfianza, elegirConfianza, calificar } = useFases(modo, onListo)

  const cuerpo = datos.cuerpo ? ` del ${datos.cuerpo}` : ''
  const acerto =
    direccion === 'materiaANumero'
      ? coincideArticulo(respuesta, datos.numero)
      : similitud(respuesta, datos.materia) >= 0.6

  return (
    <div>
      <Encabezado item={item} rotulo="Artículos" enCadena={enCadena} />

      {direccion === 'numeroAMateria' ? (
        <>
          <Enunciado>Artículo {datos.numero}{cuerpo}</Enunciado>
          <p className="apunte">¿De qué trata?</p>
        </>
      ) : (
        <>
          <Enunciado>{datos.materia}</Enunciado>
          <p className="apunte">¿Qué artículo es{cuerpo}?</p>
        </>
      )}

      {fase === 'produciendo' && (
        <>
          <label className="campo">
            <span className="oculto-visual">Tu respuesta</span>
            {direccion === 'materiaANumero' ? (
              <input
                type="text"
                value={respuesta}
                autoFocus
                inputMode="numeric"
                placeholder="Ej: 1489"
                onChange={(e) => setRespuesta(e.target.value)}
              />
            ) : (
              <textarea
                className="serif"
                rows={3}
                value={respuesta}
                autoFocus
                onChange={(e) => setRespuesta(e.target.value)}
              />
            )}
          </label>
          <BotonRevelar
            puede={respuesta.trim().length > 0}
            motivo="Escribe algo, aunque sea aproximado."
            onClick={pedirConfianza}
          />
        </>
      )}

      {fase === 'confianza' && <ElegirConfianza onElegir={elegirConfianza} />}

      {fase === 'revelado' && (
        <>
          <hr className="filete" />
          <p className={acerto ? 'verde' : 'rojo'}>
            <strong>{acerto ? 'Correcto' : 'No es'}</strong>
          </p>
          <p className="estudio">
            <strong>Artículo {datos.numero}{cuerpo}</strong>: {datos.materia}
          </p>
          <p className="apunte">Escribiste: {respuesta}</p>
          <Referencia item={item} />
          <hr className="filete" />
          <Autocalificacion confianza={confianza} onCalificar={(n) => calificar(n, { respuesta })} />
        </>
      )}
    </div>
  )
}
