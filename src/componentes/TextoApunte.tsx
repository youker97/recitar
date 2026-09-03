import { useMemo } from 'react'
import { aDocumento } from '../logica/documento'

/**
 * Muestra el texto de un apunte para leerlo.
 *
 * No se puede mostrar tal cual. Los archivos vienen con un salto de línea por
 * renglón visual, así que el texto queda cortado a mitad de frase, y traen los
 * números de página del PDF metidos entre medio. Además, mostrado como un solo
 * bloque plano se lee como un muro: los títulos no se distinguen de una frase
 * cualquiera y una cita de un artículo se confunde con el comentario del autor.
 *
 * Acá el texto se reconoce (logica/documento.ts) y se muestra con la forma que
 * ya tenía: títulos, citas legales aparte y enumeraciones.
 */
export function TextoApunte({ texto }: { texto: string }) {
  const bloques = useMemo(() => aDocumento(texto), [texto])

  return (
    <div className="lectura">
      {bloques.map((b, i) => {
        switch (b.clase) {
          case 'titulo':
            return <p key={i} className={`lectura-titulo lectura-titulo-${b.nivel}`}>{b.texto}</p>
          case 'cita':
            return (
              <blockquote key={i} className="cita-legal">
                {b.fuente && <span className="cita-fuente">{b.fuente}</span>}
                <span className="estudio">{b.texto}</span>
              </blockquote>
            )
          case 'lista':
            return b.ordenada ? (
              <ol key={i} className="lectura-lista">
                {b.puntos.map((p, k) => <li key={k} className="estudio">{p}</li>)}
              </ol>
            ) : (
              <ul key={i} className="lectura-lista">
                {b.puntos.map((p, k) => <li key={k} className="estudio">{p}</li>)}
              </ul>
            )
          default:
            return <p key={i} className="estudio">{b.texto}</p>
        }
      })}
    </div>
  )
}
