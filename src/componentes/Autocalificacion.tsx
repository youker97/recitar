import type { Confianza, Nota } from '../datos/tipos'
import { comentarioCalificacion } from '../logica/calificar'

const OPCIONES: { valor: Nota; titulo: string; nota: string }[] = [
  { valor: 'laTenia', titulo: 'La tenía', nota: 'Completa y bien dicha' },
  { valor: 'aMedias', titulo: 'A medias', nota: 'Faltó algo o estaba torcido' },
  { valor: 'meFalto', titulo: 'Me faltó', nota: 'No la tenía' },
]

export function Autocalificacion({
  confianza,
  onCalificar,
  titulo = 'Compara con la tuya y califícate:',
}: {
  confianza: Confianza
  onCalificar: (n: Nota) => void
  titulo?: string
}) {
  return (
    <div className="seccion">
      <p className="apunte">{titulo}</p>
      <div className="opciones">
        {OPCIONES.map((o) => {
          const aviso = comentarioCalificacion(confianza, o.valor)
          return (
            <button
              key={o.valor}
              type="button"
              className="opcion"
              onClick={() => onCalificar(o.valor)}
            >
              <span>
                <strong>{o.titulo}</strong>
                <small>{aviso ?? o.nota}</small>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
