import { useState } from 'react'
import { armarPedidoCorreccion, copiar, leerCorreccion, type Correccion } from '../importar/claude'

/**
 * Corrección con internet: la app arma el pedido, tú lo pegas en Claude y
 * traes su respuesta de vuelta. Nada sale de aquí solo.
 */
export function CorregirConClaude({
  enunciado,
  puntos,
  respuesta,
  referencia,
  onCorregido,
}: {
  enunciado: string
  puntos: string[]
  respuesta: string
  referencia?: string
  onCorregido: (c: Correccion) => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [pegado, setPegado] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [correccion, setCorreccion] = useState<Correccion | null>(null)

  if (!respuesta.trim()) return null

  return (
    <div className="seccion">
      {!abierto ? (
        <button type="button" className="boton" onClick={() => setAbierto(true)}>
          Que Claude la corrija de verdad
        </button>
      ) : (
        <div className="hoja">
          <strong>Corrección con Claude</strong>
          <p className="apunte" style={{ marginTop: '0.3rem' }}>
            Copia el pedido, pégalo en Claude y trae su respuesta acá. Necesita internet; sin
            internet te queda la revisión automática de arriba.
          </p>
          {aviso && <p className="apunte verde">{aviso}</p>}
          {error && <div className="aviso-error">{error}</div>}

          <div className="botonera">
            <button
              type="button"
              className="boton boton-chico boton-fuerte"
              onClick={async () => {
                const listo = await copiar(
                  armarPedidoCorreccion({ enunciado, puntos, respuesta, ref: referencia }),
                )
                setAviso(listo ? 'Pedido copiado. Pégalo en Claude.' : 'No se pudo copiar solo.')
              }}
            >
              Copiar el pedido
            </button>
          </div>

          <label className="campo" style={{ marginTop: '0.7rem' }}>
            <span>Pega acá la corrección</span>
            <textarea rows={4} value={pegado} onChange={(e) => setPegado(e.target.value)} />
          </label>
          <button
            type="button"
            className="boton boton-chico"
            disabled={!pegado.trim()}
            onClick={() => {
              try {
                const c = leerCorreccion(pegado, puntos.length)
                setError(null)
                setCorreccion(c)
                onCorregido(c)
              } catch (e) {
                setError(e instanceof Error ? e.message : 'No se pudo leer la corrección.')
              }
            }}
          >
            Aplicar la corrección
          </button>

          {correccion && (
            <div style={{ marginTop: '0.8rem' }}>
              {correccion.loQueFalto && (
                <p><strong>Lo que faltó:</strong> {correccion.loQueFalto}</p>
              )}
              {correccion.comentario && <p className="apunte">{correccion.comentario}</p>}
              <ul className="apunte" style={{ paddingLeft: '1.1rem' }}>
                {correccion.puntos
                  .filter((p) => p.comentario)
                  .map((p) => (
                    <li key={p.indice} className={p.logrado ? 'verde' : 'rojo'}>
                      {puntos[p.indice]}: {p.comentario}
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
