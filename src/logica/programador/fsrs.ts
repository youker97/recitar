import { Rating, State, createEmptyCard, fsrs, generatorParameters, type Card, type Grade } from 'ts-fsrs'
import type { Nota, Progreso } from '../../datos/tipos'

const DIA = 24 * 60 * 60 * 1000

const parametros = generatorParameters({
  request_retention: 0.9,
  enable_fuzz: true,
  enable_short_term: true,
})

const motor = fsrs(parametros)

const NOTA_A_RATING: Record<Nota, Grade> = {
  meFalto: Rating.Again,
  aMedias: Rating.Hard,
  laTenia: Rating.Good,
}

const ESTADO_A_STATE: Record<Progreso['estado'], State> = {
  nuevo: State.New,
  aprendiendo: State.Learning,
  repaso: State.Review,
  reaprendiendo: State.Relearning,
}

const STATE_A_ESTADO: Record<State, Progreso['estado']> = {
  [State.New]: 'nuevo',
  [State.Learning]: 'aprendiendo',
  [State.Review]: 'repaso',
  [State.Relearning]: 'reaprendiendo',
}

function aCarta(p: Progreso, ahora: number): Card {
  if (p.estado === 'nuevo' && p.repeticiones === 0) return createEmptyCard(new Date(ahora))
  return {
    due: new Date(p.vence),
    stability: p.estabilidad || 0,
    difficulty: p.dificultad || 0,
    elapsed_days: p.transcurridoDias || 0,
    scheduled_days: p.intervaloDias || 0,
    reps: p.repeticiones,
    lapses: p.lapsos,
    state: ESTADO_A_STATE[p.estado],
    last_review: p.ultimoRepaso ? new Date(p.ultimoRepaso) : undefined,
  }
}

export function programarConFsrs(previo: Progreso, nota: Nota, ahora: number): Progreso {
  const carta = aCarta(previo, ahora)
  const { card } = motor.next(carta, new Date(ahora), NOTA_A_RATING[nota])
  return {
    ...previo,
    estabilidad: card.stability,
    dificultad: card.difficulty,
    intervaloDias: card.scheduled_days,
    transcurridoDias: card.elapsed_days,
    estado: STATE_A_ESTADO[card.state],
    vence: card.due.getTime(),
    // La caja se mantiene al día para poder cambiar de motor sin perder el hilo.
    caja: Math.min(5, Math.max(0, INDICE_POR_DIAS(card.scheduled_days))),
  }
}

function INDICE_POR_DIAS(dias: number): number {
  const cortes = [0, 1, 3, 7, 16, 35]
  let i = 0
  for (let k = 0; k < cortes.length; k++) if (dias >= cortes[k]) i = k
  return i
}

export const DIA_MS = DIA
