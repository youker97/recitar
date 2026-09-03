/**
 * Muestra el texto de un apunte para leerlo.
 *
 * No se puede mostrar tal cual: los archivos vienen con un salto de línea por
 * renglón visual, así que el texto queda cortado a mitad de frase. Acá se
 * respetan los párrafos y se deja que las líneas se acomoden al ancho.
 */
export function TextoApunte({ texto }: { texto: string }) {
  const parrafos = texto
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean)

  return (
    <div className="lectura">
      {parrafos.map((p, i) => (
        <p key={i} className="estudio">{p}</p>
      ))}
    </div>
  )
}
