import { useMemo, useState } from 'react'
import type { PaginaPdf } from '../importar/pdf'
import { normalizar } from '../logica/comparar'

/**
 * Elegir páginas de un PDF largo. Un apunte de 300 hojas no se revisa con una
 * lista de 300 tarjetas: se elige por rango, se busca, y el detalle se abre
 * solo si hace falta.
 */
export function SelectorPaginas({
  paginas,
  elegidas,
  onCambiar,
}: {
  paginas: PaginaPdf[]
  elegidas: Set<number>
  onCambiar: (nuevas: Set<number>) => void
}) {
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [mirando, setMirando] = useState<number | null>(null)

  const coincidencias = useMemo(() => {
    const filtro = normalizar(busqueda)
    if (!filtro) return null
    return new Set(paginas.filter((p) => normalizar(p.texto).includes(filtro)).map((p) => p.numero))
  }, [paginas, busqueda])

  const caracteres = paginas
    .filter((p) => elegidas.has(p.numero))
    .reduce((suma, p) => suma + p.texto.length, 0)

  function aplicarRango() {
    const a = Number(desde) || 1
    const b = Number(hasta) || paginas.length
    const nuevas = new Set<number>()
    for (let n = Math.min(a, b); n <= Math.max(a, b); n++) {
      if (paginas.some((p) => p.numero === n)) nuevas.add(n)
    }
    onCambiar(nuevas)
  }

  function alternar(numero: number) {
    const nuevas = new Set(elegidas)
    if (nuevas.has(numero)) nuevas.delete(numero)
    else nuevas.add(numero)
    onCambiar(nuevas)
  }

  const pagina = mirando != null ? paginas.find((p) => p.numero === mirando) : null

  return (
    <div className="seccion">
      <div className="botonera" style={{ marginBottom: '0.5rem' }}>
        <button type="button" className="boton boton-chico" onClick={() => onCambiar(new Set(paginas.map((p) => p.numero)))}>
          Todas
        </button>
        <button type="button" className="boton boton-chico" onClick={() => onCambiar(new Set())}>
          Ninguna
        </button>
        {coincidencias && (
          <button type="button" className="boton boton-chico" onClick={() => onCambiar(new Set(coincidencias))}>
            Solo las {coincidencias.size} encontradas
          </button>
        )}
      </div>

      <div className="rango">
        <label>
          <span className="apunte">Desde</span>
          <input type="number" min={1} max={paginas.length} inputMode="numeric" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </label>
        <label>
          <span className="apunte">Hasta</span>
          <input type="number" min={1} max={paginas.length} inputMode="numeric" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </label>
        <button type="button" className="boton boton-chico" onClick={aplicarRango}>Aplicar</button>
      </div>

      <label className="campo" style={{ marginTop: '0.6rem' }}>
        <span className="oculto-visual">Buscar dentro del PDF</span>
        <input
          type="text"
          value={busqueda}
          placeholder="Buscar un tema dentro del PDF"
          onChange={(e) => setBusqueda(e.target.value)}
        />
        {coincidencias && (
          <span className="apunte">
            {coincidencias.size} páginas contienen “{busqueda}”. Van marcadas con un punto.
          </span>
        )}
      </label>

      <div className="paginas" role="group" aria-label="Páginas del PDF">
        {paginas.map((p) => (
          <button
            key={p.numero}
            type="button"
            className={`pagina-chip${coincidencias?.has(p.numero) ? ' pagina-hallada' : ''}${p.texto.trim() ? '' : ' pagina-vacia'}`}
            aria-pressed={elegidas.has(p.numero)}
            title={p.texto.slice(0, 120).replace(/\s+/g, ' ') || 'Sin texto (puede ser una imagen)'}
            onClick={() => alternar(p.numero)}
            onDoubleClick={() => setMirando(p.numero)}
          >
            {p.numero}
          </button>
        ))}
      </div>

      <p className="apunte">
        <strong>{elegidas.size}</strong> de {paginas.length} páginas · {caracteres.toLocaleString('es-CL')} caracteres.
        Toca una para incluirla o sacarla; toca dos veces para leerla.
      </p>

      {pagina && (
        <div className="hoja">
          <div className="titulo-seccion">
            <h3>Página {pagina.numero}</h3>
            <button type="button" className="boton boton-chico" onClick={() => setMirando(null)}>Cerrar</button>
          </div>
          <p className="apunte" style={{ whiteSpace: 'pre-wrap', maxHeight: '14rem', overflow: 'auto' }}>
            {pagina.texto || '(sin texto: puede ser una imagen escaneada)'}
          </p>
        </div>
      )}
    </div>
  )
}
