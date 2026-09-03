import { useMemo, useState } from 'react'
import { useCursoActivo, useDatos } from '../datos/hooks'
import { resumenDeItem } from '../logica/resumen'
import { NOMBRE_TIPO } from '../datos/tipos'
import { ACIERTOS_PARA_SALIR } from '../logica/programador'

export function Errores() {
  const curso = useCursoActivo()
  const datos = useDatos(curso?.id)
  const [soloGraves, setSoloGraves] = useState(false)

  const errores = useMemo(
    () =>
      datos
        .filter((d) => d.progreso.enErrores && (!soloGraves || d.progreso.fallosGraves > 0))
        .sort((a, b) => {
          const graves = b.progreso.fallosGraves - a.progreso.fallosGraves
          if (graves !== 0) return graves
          const fallos = b.progreso.totalFallos - a.progreso.totalFallos
          if (fallos !== 0) return fallos
          return (b.progreso.ultimoFallo ?? 0) - (a.progreso.ultimoFallo ?? 0)
        }),
    [datos, soloGraves],
  )

  const graves = datos.filter((d) => d.progreso.enErrores && d.progreso.fallosGraves > 0).length

  return (
    <div>
      <div className="titulo-seccion">
        <h1>Registro de errores</h1>
        <span className="lado numeral">{errores.length}</span>
      </div>

      <p className="apunte">
        Un ítem entra acá solo, apenas lo fallas, y sale cuando lo aciertas {ACIERTOS_PARA_SALIR} veces
        seguidas. Los <span className="rojo">graves</span> son los que fallaste diciendo que estabas seguro.
      </p>

      <div className="botonera seccion">
        <a className="boton boton-fuerte" href="#/estudiar?errores=1">Estudiar solo mis errores</a>
        {graves > 0 && (
          <button
            type="button"
            className="boton"
            aria-pressed={soloGraves}
            onClick={() => setSoloGraves((v) => !v)}
          >
            {soloGraves ? 'Ver todos' : `Ver solo los ${graves} graves`}
          </button>
        )}
      </div>

      {errores.length === 0 ? (
        <div className="vacio">
          <p>No tienes errores pendientes.</p>
        </div>
      ) : (
        <ul className="lista-limpia">
          {errores.map(({ item, progreso }) => (
            <li key={item.id} className="renglon">
              <div className="crece">
                <div className="estudio" style={{ fontSize: '1.02rem' }}>{resumenDeItem(item)}</div>
                <div className="ref">
                  {[item.ref, item.bloque, NOMBRE_TIPO[item.tipo]].filter(Boolean).join(' · ')}
                </div>
                <div className="apunte">
                  {progreso.totalFallos} {progreso.totalFallos === 1 ? 'fallo' : 'fallos'}
                  {progreso.fallosGraves > 0 && `, ${progreso.fallosGraves} graves`}
                  {' · '}
                  {progreso.aciertosSeguidos} de {ACIERTOS_PARA_SALIR} aciertos seguidos
                </div>
              </div>
              {progreso.fallosGraves > 0 && <span className="etiqueta etiqueta-grave">grave</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
