export function Pauta({
  puntos,
  marcados,
  onMarcar,
  titulo = 'Tilda solo lo que realmente escribiste',
}: {
  puntos: string[]
  marcados: boolean[]
  onMarcar: (i: number, v: boolean) => void
  titulo?: string
}) {
  const logrados = marcados.filter(Boolean).length
  return (
    <div className="seccion">
      <div className="titulo-seccion">
        <h3>{titulo}</h3>
        <span className="lado numeral">{logrados} de {puntos.length}</span>
      </div>
      <ul className="pauta">
        {puntos.map((p, i) => (
          <li key={i}>
            <label>
              <input
                type="checkbox"
                checked={marcados[i] ?? false}
                onChange={(e) => onMarcar(i, e.target.checked)}
              />
              <span>{p}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function sugerirNota(logrados: number, total: number): 'laTenia' | 'aMedias' | 'meFalto' {
  if (total === 0) return 'aMedias'
  const razon = logrados / total
  if (razon >= 0.85) return 'laTenia'
  if (razon >= 0.5) return 'aMedias'
  return 'meFalto'
}
