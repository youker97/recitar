import { useCallback, useRef, useState, type ReactNode } from 'react'
import type { Ajustes, Confianza, Item, ModoEstudio, Nota } from '../datos/tipos'

export interface ResultadoModo {
  modo: ModoEstudio
  confianza: Confianza
  nota: Nota
  duracionMs: number
  respuesta?: string
  aciertos?: number
  total?: number
}

export interface PropsModo {
  item: Item
  ajustes: Ajustes
  onListo: (r: ResultadoModo) => void
  /** Los bloques del curso, para el modo triaje. */
  bloques?: string[]
  /** Marca visual: esto es una repregunta dentro de una cadena. */
  enCadena?: boolean
  /** Cuántas veces se ha repasado este ítem (para variar los huecos). */
  vuelta?: number
  /** La sesión es oral: se responde hablando. */
  oral?: boolean
}

export type Fase = 'produciendo' | 'confianza' | 'revelado'

/** La misma máquina de estados para todos los modos: producir, decir cuán
 *  seguro estoy, recién ahí ver la respuesta, y calificarme. */
export function useFases(modo: ModoEstudio, onListo: (r: ResultadoModo) => void) {
  const [fase, setFase] = useState<Fase>('produciendo')
  const [confianza, setConfianza] = useState<Confianza>('masOMenos')
  const inicio = useRef(Date.now())

  const pedirConfianza = useCallback(() => setFase('confianza'), [])

  const elegirConfianza = useCallback((c: Confianza) => {
    setConfianza(c)
    setFase('revelado')
  }, [])

  const calificar = useCallback(
    (nota: Nota, extra?: Partial<ResultadoModo>) => {
      onListo({
        modo,
        confianza,
        nota,
        duracionMs: Date.now() - inicio.current,
        ...extra,
      })
    },
    [confianza, modo, onListo],
  )

  return { fase, confianza, pedirConfianza, elegirConfianza, calificar }
}

export function Enunciado({ children }: { children: ReactNode }) {
  return <p className="estudio-grande">{children}</p>
}

export function Referencia({ item }: { item: Item }) {
  if (!item.ref) return null
  return <p className="ref">{item.ref}</p>
}

export function Encabezado({ item, rotulo, enCadena }: { item: Item; rotulo: string; enCadena?: boolean }) {
  return (
    <div className="titulo-seccion">
      <h2>{enCadena ? 'Repregunta' : rotulo}</h2>
      <span className="lado">{item.bloque}</span>
    </div>
  )
}

export function BotonRevelar({
  puede,
  onClick,
  motivo,
  texto = 'Ya está, mostrar la respuesta',
}: {
  puede: boolean
  onClick: () => void
  motivo?: string
  texto?: string
}) {
  return (
    <div className="pie-fijo">
      <button type="button" className="boton boton-fuerte boton-ancho" disabled={!puede} onClick={onClick}>
        {texto}
      </button>
      {!puede && motivo && <p className="apunte centrado" style={{ marginTop: '0.4rem' }}>{motivo}</p>}
    </div>
  )
}
