import type { Dominio as DatosDominio } from '../logica/dominio'

export function ListaDominio({ bloques }: { bloques: DatosDominio[] }) {
  return (
    <div className="dominio">
      {bloques.map((b) => (
        <div key={b.bloque} className="dominio-fila">
          <div className="crece">
            <div>{b.bloque}</div>
            <div className="apunte">
              {b.dominados} de {b.total} firmes
              {b.enErrores > 0 && ` · ${b.enErrores} fallando`}
              {b.sinVer > 0 && ` · ${b.sinVer} sin ver`}
            </div>
          </div>
          <span className="barra" aria-hidden="true">
            <span style={{ width: `${Math.max(2, b.porcentaje)}%` }} />
          </span>
          <span className="porcentaje">{b.porcentaje}%</span>
        </div>
      ))}
    </div>
  )
}
