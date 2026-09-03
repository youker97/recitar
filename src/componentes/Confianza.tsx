import type { Confianza } from '../datos/tipos'

const OPCIONES: { valor: Confianza; titulo: string; nota: string }[] = [
  { valor: 'seguro', titulo: 'Seguro', nota: 'Lo afirmaría en la prueba' },
  { valor: 'masOMenos', titulo: 'Más o menos', nota: 'Algo tengo, no todo' },
  { valor: 'adivinando', titulo: 'Adivinando', nota: 'Tiré para algún lado' },
]

export function ElegirConfianza({ onElegir }: { onElegir: (c: Confianza) => void }) {
  return (
    <div className="seccion">
      <p className="apunte">Antes de ver la respuesta: ¿qué tan seguro estás?</p>
      <div className="opciones">
        {OPCIONES.map((o) => (
          <button
            key={o.valor}
            type="button"
            className="opcion"
            onClick={() => onElegir(o.valor)}
          >
            <span>
              <strong>{o.titulo}</strong>
              <small>{o.nota}</small>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
