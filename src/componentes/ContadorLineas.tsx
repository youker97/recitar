import { useEffect, useRef, useState } from 'react'

/**
 * Caja de texto con límite duro de líneas. El contador se pone rojo al
 * pasarse y avisa hacia afuera para bloquear el "revelar".
 */
export function CajaConLimite({
  valor,
  onCambiar,
  limite,
  onExcedido,
  etiqueta,
  autoFoco,
}: {
  valor: string
  onCambiar: (v: string) => void
  limite: number
  onExcedido: (excedido: boolean) => void
  etiqueta: string
  autoFoco?: boolean
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [lineas, setLineas] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const estilo = window.getComputedStyle(el)
    const alturaLinea = parseFloat(estilo.lineHeight) || 22
    const relleno = parseFloat(estilo.paddingTop) + parseFloat(estilo.paddingBottom)
    // Con la altura fija, scrollHeight nunca baja del alto de la caja: hay que
    // encogerla un instante para medir cuánto ocupa el texto de verdad.
    const alturaPrevia = el.style.height
    const minimaPrevia = el.style.minHeight
    el.style.minHeight = '0px'
    el.style.height = '0px'
    const alto = el.scrollHeight
    el.style.height = alturaPrevia
    el.style.minHeight = minimaPrevia
    const contadas = valor.trim() === ''
      ? 0
      : Math.max(1, Math.round((alto - relleno) / alturaLinea))
    setLineas(contadas)
    onExcedido(contadas > limite)
  }, [valor, limite, onExcedido])

  const excedido = lineas > limite

  return (
    <label className="campo">
      <span>{etiqueta}</span>
      <textarea
        ref={ref}
        className={`serif caja-limite${excedido ? ' pasado' : ''}`}
        rows={limite}
        value={valor}
        autoFocus={autoFoco}
        onChange={(e) => onCambiar(e.target.value)}
        aria-describedby="contador-lineas"
      />
      <span
        id="contador-lineas"
        className={`contador${excedido ? ' contador-pasado' : ''}`}
        role="status"
      >
        {lineas} de {limite} líneas
        {excedido ? ' — córtala, en la prueba tampoco te van a dar más espacio' : ''}
      </span>
    </label>
  )
}
