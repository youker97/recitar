import { useEffect, useRef, useState } from 'react'

export function formatearDuracion(ms: number): string {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function useCronometro(arrancarSolo = false) {
  const [ms, setMs] = useState(0)
  const [corriendo, setCorriendo] = useState(arrancarSolo)
  const desde = useRef<number>(Date.now())
  const acumulado = useRef(0)

  useEffect(() => {
    if (!corriendo) return
    desde.current = Date.now()
    const id = window.setInterval(() => {
      setMs(acumulado.current + (Date.now() - desde.current))
    }, 250)
    return () => {
      acumulado.current += Date.now() - desde.current
      window.clearInterval(id)
    }
  }, [corriendo])

  return {
    ms,
    corriendo,
    arrancar: () => setCorriendo(true),
    detener: () => setCorriendo(false),
    reiniciar: () => { acumulado.current = 0; setMs(0) },
  }
}

export function Cronometro({ ms, sugerido }: { ms: number; sugerido?: number }) {
  const pasado = sugerido != null && ms > sugerido * 60_000
  return (
    <div>
      <div className={`cronometro${pasado ? ' rojo' : ''}`} role="timer" aria-live="off">
        {formatearDuracion(ms)}
      </div>
      {sugerido != null && (
        <div className="apunte">
          {pasado ? `Te pasaste de los ${sugerido} min sugeridos` : `Tiempo sugerido: ${sugerido} min`}
        </div>
      )}
    </div>
  )
}
