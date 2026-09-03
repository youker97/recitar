import type { Racha as DatosRacha } from '../logica/racha'
import { hoyISO } from '../logica/plan'

export function Racha({ racha }: { racha: DatosRacha }) {
  const hoy = hoyISO()
  const falta = Math.max(0, racha.meta - racha.respuestasHoy)

  return (
    <div className="racha">
      <div className="racha-numero">
        {racha.actual}
        <small>{racha.actual === 1 ? 'día' : 'días'}</small>
      </div>
      <div className="crece">
        <strong>
          {racha.hoyCumplido
            ? 'Hoy ya está'
            : racha.enRiesgo
              ? `Te faltan ${falta} para no cortarla`
              : falta === racha.meta
                ? 'Empieza la racha de hoy'
                : `Te faltan ${falta}`}
        </strong>
        <div className="barra barra-ancha" style={{ marginTop: '0.35rem' }}>
          <span style={{ width: `${Math.min(100, (racha.respuestasHoy / racha.meta) * 100)}%` }} />
        </div>
        <div className="calendario" aria-hidden="true">
          {racha.dias.map((d) => (
            <i
              key={d.fecha}
              data-nivel={d.cumplido ? 2 : d.respuestas > 0 ? 1 : 0}
              data-hoy={d.fecha === hoy ? 'si' : undefined}
              title={`${d.fecha}: ${d.respuestas}`}
            />
          ))}
        </div>
        <div className="apunte" style={{ marginTop: '0.35rem' }}>
          {racha.respuestasHoy} de {racha.meta} hoy · récord {racha.record} días
        </div>
      </div>
    </div>
  )
}
