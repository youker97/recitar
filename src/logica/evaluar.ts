// Corrección automática de un ensayo (evaluación completa, sin ir mostrando
// las respuestas). Todo lo que se corrige acá se corrige sin internet.

import type {
  Confianza, DatosAlternativas, DatosArticulo, DatosLista, DatosTextoLegal,
  DatosTriaje, DatosVF, Item, Nota, Verbo,
} from '../datos/tipos'
import { coincideArticulo, compararLista, similitud } from './comparar'
import { aciertaHueco, prepararHuecos } from './huecos'
import { esGrave } from './calificar'

export interface RespuestaEnsayo {
  confianza: Confianza
  /** vf */
  esVerdadera?: boolean
  /** alternativas */
  opcion?: number
  /** lista, artículo */
  texto?: string
  /** texto legal */
  huecos?: string[]
  /** triaje */
  bloque?: string
  verbo?: Verbo
}

export interface ResultadoEnsayo {
  nota: Nota
  grave: boolean
  correcto: boolean
  aciertos?: number
  total?: number
  /** Qué era lo correcto, para el informe final. */
  esperado: string
  dado: string
}

function notaPorProporcion(razon: number): Nota {
  if (razon >= 0.8) return 'laTenia'
  if (razon >= 0.4) return 'aMedias'
  return 'meFalto'
}

export function evaluarRespuesta(
  item: Item,
  respuesta: RespuestaEnsayo,
  vuelta = 0,
): ResultadoEnsayo {
  let nota: Nota = 'meFalto'
  let aciertos: number | undefined
  let total: number | undefined
  let esperado = ''
  let dado = ''

  switch (item.tipo) {
    case 'vf': {
      const d = item.datos as DatosVF
      nota = respuesta.esVerdadera === d.esVerdadera ? 'laTenia' : 'meFalto'
      esperado = d.esVerdadera ? 'Verdadero' : 'Falso'
      dado = respuesta.esVerdadera === undefined ? '—' : respuesta.esVerdadera ? 'Verdadero' : 'Falso'
      break
    }
    case 'alternativas': {
      const d = item.datos as DatosAlternativas
      nota = respuesta.opcion === d.correcta ? 'laTenia' : 'meFalto'
      esperado = d.opciones[d.correcta] ?? ''
      dado = respuesta.opcion != null ? (d.opciones[respuesta.opcion] ?? '—') : '—'
      break
    }
    case 'lista': {
      const d = item.datos as DatosLista
      const escritas = (respuesta.texto ?? '').split('\n').map((l) => l.trim()).filter(Boolean)
      const r = compararLista(escritas, d.elementos, d.ordenImporta)
      aciertos = r.aciertos
      total = r.total
      nota = notaPorProporcion(r.total === 0 ? 0 : r.aciertos / r.total)
      esperado = d.elementos.join(' · ')
      dado = escritas.join(' · ') || '—'
      break
    }
    case 'articulo': {
      const d = item.datos as DatosArticulo
      const texto = respuesta.texto ?? ''
      const acierta = coincideArticulo(texto, d.numero) || similitud(texto, d.materia) >= 0.6
      nota = acierta ? 'laTenia' : 'meFalto'
      esperado = `Art. ${d.numero} — ${d.materia}`
      dado = texto || '—'
      break
    }
    case 'textoLegal': {
      const d = item.datos as DatosTextoLegal
      const preparado = prepararHuecos(d.textoLiteral, vuelta)
      const dadas = respuesta.huecos ?? []
      aciertos = preparado.respuestas.filter((correcta, k) => aciertaHueco(dadas[k] ?? '', correcta)).length
      total = preparado.respuestas.length
      nota = notaPorProporcion(total === 0 ? 0 : aciertos / total)
      esperado = preparado.respuestas.join(' · ')
      dado = dadas.join(' · ') || '—'
      break
    }
    case 'triaje': {
      const d = item.datos as DatosTriaje
      const bloqueOk = respuesta.bloque === d.bloque
      const verboOk = respuesta.verbo === d.verbo
      aciertos = (bloqueOk ? 1 : 0) + (verboOk ? 1 : 0)
      total = 2
      nota = bloqueOk && verboOk ? 'laTenia' : bloqueOk || verboOk ? 'aMedias' : 'meFalto'
      esperado = `${d.bloque} · ${d.verbo}`
      dado = `${respuesta.bloque ?? '—'} · ${respuesta.verbo ?? '—'}`
      break
    }
    default: {
      // Los desarrollos y las repreguntas habladas no se corrigen solas.
      nota = 'aMedias'
      esperado = ''
      dado = respuesta.texto ?? ''
    }
  }

  // Acertar adivinando no cuenta como saber.
  if (nota === 'laTenia' && respuesta.confianza === 'adivinando') nota = 'aMedias'

  return {
    nota,
    grave: esGrave(respuesta.confianza, nota),
    correcto: nota === 'laTenia',
    aciertos,
    total,
    esperado,
    dado,
  }
}

/** Los tipos que la app puede corregir sola, sin internet ni criterio humano. */
export function seCorrigeSola(item: Item): boolean {
  return item.tipo !== 'desarrollo' && item.tipo !== 'repregunta' && item.tipo !== 'concepto'
}
