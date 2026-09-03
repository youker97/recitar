import type { Revision } from '../logica/corrector'

/**
 * Lo que la app encontró sola en el texto escrito. No es una nota: es una
 * ayuda para que la autocalificación no sea a ojo.
 */
export function RevisionAutomatica({
  revision,
  titulo = 'Lo que encontré en tu respuesta',
  onCorregir,
}: {
  revision: Revision
  titulo?: string
  /** Permite marcar a mano un punto que la app no supo ver. */
  onCorregir?: (indice: number, encontrado: boolean) => void
}) {
  return (
    <div className="seccion">
      <div className="titulo-seccion">
        <h3>{titulo}</h3>
        <span className="lado numeral">{revision.encontrados} de {revision.total}</span>
      </div>
      <ul className="pauta">
        {revision.puntos.map((p) => (
          <li key={p.indice}>
            <label>
              <input
                type="checkbox"
                checked={p.encontrado}
                disabled={!onCorregir}
                onChange={(e) => onCorregir?.(p.indice, e.target.checked)}
              />
              <span className={p.encontrado ? '' : 'rojo'}>
                {p.texto}
                {!p.encontrado && p.faltantes.length > 0 && (
                  <span className="apunte"> — no vi: {p.faltantes.join(', ')}</span>
                )}
              </span>
            </label>
          </li>
        ))}
      </ul>
      {onCorregir && (
        <p className="apunte">
          La app busca términos, no entiende ideas. Si dijiste algo con otras palabras, márcalo tú.
        </p>
      )}
    </div>
  )
}
