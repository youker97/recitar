// Los conceptos que un bloque tiene que dejarte: lo que deberías poder
// escribir de memoria, con la hoja en blanco, sin que nadie te pregunte nada.
//
// Se sacan del propio material, no de una lista aparte, así que crecen solos
// cuando importas más.

import type {
  DatosAlternativas, DatosArticulo, DatosDesarrollo, DatosLista,
  DatosRepregunta, DatosTextoLegal, DatosVF, Item,
} from '../datos/tipos'
import { clavesDe, puntosDe } from './corrector'
import { contiene, normalizar } from './comparar'
import { detectarSecciones } from './mapa'

export interface Concepto {
  termino: string
  itemId: string
  ref: string
  /** De qué ítem salió, para poder ir a estudiarlo. */
  bloque: string
}

/** Tope por ítem: un ítem largo no puede copar el bloque entero. */
const POR_ITEM = 4

function terminosDe(item: Item): string[] {
  switch (item.tipo) {
    case 'vf': {
      const d = item.datos as DatosVF
      return d.claves?.length ? d.claves : clavesDe({ texto: d.justificacion }, 3)
    }
    case 'alternativas': {
      const d = item.datos as DatosAlternativas
      return clavesDe({ texto: d.opciones[d.correcta] ?? '' }, 2)
    }
    case 'lista': {
      const d = item.datos as DatosLista
      return d.elementos
    }
    case 'articulo': {
      const d = item.datos as DatosArticulo
      return [d.numero, ...clavesDe({ texto: d.materia }, 2)]
    }
    case 'textoLegal': {
      const d = item.datos as DatosTextoLegal
      return [d.numero]
    }
    case 'desarrollo': {
      const d = item.datos as DatosDesarrollo
      return puntosDe(d.checklist).flatMap((p) => clavesDe(p, 2))
    }
    case 'repregunta': {
      const d = item.datos as DatosRepregunta
      return clavesDe({ texto: d.respuesta }, 2)
    }
    default:
      // El triaje entrena identificar la pregunta, no producir contenido.
      return []
  }
}

export function conceptosDeBloque(items: Item[]): Concepto[] {
  const vistos = new Set<string>()
  const salida: Concepto[] = []
  for (const item of items) {
    if (item.suspendido) continue
    for (const termino of terminosDe(item).slice(0, POR_ITEM)) {
      const limpio = termino.trim()
      const clave = normalizar(limpio)
      if (!clave || clave.length < 3 || vistos.has(clave)) continue
      vistos.add(clave)
      salida.push({ termino: limpio, itemId: item.id, ref: item.ref, bloque: item.bloque })
    }
  }
  return salida
}

// Palabras que en un apunte de Derecho aparecen en todas partes y no
// distinguen nada.
const HUECAS = new Set([
  'manera', 'forma', 'caso', 'casos', 'modo', 'parte', 'partes', 'tal', 'asi',
  'cual', 'cuales', 'decir', 'ejemplo', 'sentido', 'materia', 'punto', 'trata',
  'refiere', 'existe', 'existen', 'aparece', 'concurre', 'concurren', 'permite',
  'consiste', 'requiere', 'exige', 'supone', 'comprende', 'contiene', 'resulta',
  'realiza', 'produce', 'ocurre', 'segundo', 'primero', 'ultimo', 'siguiente',
  'general', 'mismo', 'misma', 'propio', 'propia', 'toda', 'todo', 'cada',
  'entre', 'sobre', 'hacia', 'desde', 'durante', 'mediante', 'segun', 'contra',
  // Verbos con que el apunte hila la explicación: no nombran nada.
  'distingue', 'distinguen', 'reconoce', 'reconocen', 'sostiene', 'sostienen',
  'afirma', 'afirman', 'considera', 'consideran', 'entiende', 'entienden',
  'llama', 'llaman', 'denomina', 'denominan', 'siguiendo', 'tratandose',
  'senala', 'senalan', 'agrega', 'agregan', 'admite', 'admiten', 'basta',
  // Conectores y demostrativos.
  'estos', 'estas', 'esos', 'esas', 'aquellos', 'aquellas', 'dicha', 'dicho',
  'ademas', 'tambien', 'solo', 'siempre', 'nunca', 'cuando', 'donde', 'porque',
  'mientras', 'aunque', 'sino', 'pero', 'tres', 'cuatro', 'cinco',
])

interface Palabra {
  texto: string
  clave: string
  inicio: number
  fin: number
  contenido: boolean
}

function palabrasDe(texto: string): Palabra[] {
  const salida: Palabra[] = []
  const patron = /[\p{L}\p{N}]+/gu
  let m: RegExpExecArray | null
  while ((m = patron.exec(texto)) !== null) {
    const clave = normalizar(m[0])
    salida.push({
      texto: m[0],
      clave,
      inicio: m.index,
      fin: m.index + m[0].length,
      // Los adverbios en -mente son todos de relleno: no hace falta listarlos.
      contenido: clave.length >= 4 && !HUECAS.has(clave) && !/^\d+$/.test(clave)
        && !(clave.length >= 7 && clave.endsWith('mente')),
    })
  }
  return salida
}

/**
 * Un término sacado del texto se muestra como se lee, no como venía: sin la
 * numeración del título y sin los TÍTULOS EN MAYÚSCULAS, que gritan.
 */
export function presentar(termino: string): string {
  const sinNumeracion = termino
    .replace(/^\s*(?:\d{1,2}(?:\.\d{1,2})*|[IVXLCDM]{1,7}|[a-zA-Z])\s*[.)\-–]{1,3}\s*/, '')
    .replace(/[.:;,]$/, '')
    .trim()
  if (!sinNumeracion) return termino.trim()
  const letras = sinNumeracion.replace(/[^\p{L}]/gu, '')
  const grita = letras.length > 3 && letras === letras.toUpperCase()
  if (!grita) return sinNumeracion
  return sinNumeracion[0].toUpperCase() + sinNumeracion.slice(1).toLowerCase()
}

/**
 * "Elementos negativos" y "negativos del tipo" son pedazos de "elementos
 * negativos del tipo": preguntarlos por separado no es vocabulario, es ruido.
 * Se queda el más largo.
 */
function sinSolapados(conceptos: Concepto[]): Concepto[] {
  const claves = conceptos.map((c) => normalizar(c.termino))
  return conceptos.filter((_, i) =>
    !claves.some((otra, j) => j !== i && otra.length > claves[i].length && otra.includes(claves[i])))
}

/**
 * Conceptos sacados directamente de un apunte, para cuando todavía no hay
 * preguntas generadas.
 *
 * Un concepto de verdad se repite: "principio de legalidad" aparece cinco
 * veces en el capítulo, "comprende actualmente" una sola. Por eso se buscan
 * las frases que vuelven, más los títulos de los temas, que casi siempre son
 * el nombre exacto de la institución.
 */
export function conceptosDeTexto(texto: string, bloque = '', ref = ''): Concepto[] {
  const salida: Concepto[] = []
  const vistos = new Set<string>()

  const agregar = (termino: string) => {
    const limpio = presentar(termino)
    const clave = normalizar(limpio)
    if (!clave || clave.length < 6 || vistos.has(clave)) return
    vistos.add(clave)
    salida.push({ termino: limpio, itemId: '', ref, bloque })
  }

  // 1. Los títulos de los temas, sin su numeración.
  for (const seccion of detectarSecciones(texto)) {
    const limpio = presentar(seccion.titulo)
    if (limpio.split(/\s+/).length <= 8 && /\p{L}/u.test(limpio)) agregar(limpio)
  }

  // 2. Las frases de dos y tres palabras que se repiten.
  const palabras = palabrasDe(texto)
  const cuenta = new Map<string, { forma: string; veces: number; palabras: number }>()
  for (let i = 0; i < palabras.length; i++) {
    if (!palabras[i].contenido) continue
    for (const largo of [2, 3, 4]) {
      const fin = i + largo - 1
      if (fin >= palabras.length) continue
      if (!palabras[fin].contenido) continue
      // A lo más una palabra vacía intercalada ("bien jurídico protegido").
      const huecas = palabras.slice(i, fin + 1).filter((p) => !p.contenido).length
      if (huecas > 1) continue
      const forma = texto.slice(palabras[i].inicio, palabras[fin].fin)
      // Una coma o un paréntesis significan que se cruzó de una idea a otra.
      if (/[\n.;:!?,()«»"]/.test(forma)) continue
      const clave = normalizar(forma)
      if (clave.length < 10) continue
      const previo = cuenta.get(clave)
      if (previo) previo.veces++
      else cuenta.set(clave, { forma, veces: 1, palabras: largo })
    }
  }

  const minimo = texto.length > 20000 ? 4 : texto.length > 6000 ? 3 : 2
  const frecuentes = [...cuenta.values()]
    // Una frase de cuatro palabras solo es una institución si vuelve de verdad;
    // si no, es un pedazo de oración que se repitió de casualidad.
    .filter((x) => x.veces >= (x.palabras >= 4 ? minimo + 1 : minimo))
    .sort((a, b) => b.veces - a.veces || b.forma.length - a.forma.length)
    .slice(0, 40)

  for (const f of frecuentes) agregar(f.forma)

  return sinSolapados(salida).slice(0, 45)
}

export interface ResultadoVolcado {
  encontrados: Concepto[]
  faltantes: Concepto[]
  total: number
  /** 0 a 100. */
  cobertura: number
}

export function revisarVolcado(texto: string, conceptos: Concepto[]): ResultadoVolcado {
  const encontrados: Concepto[] = []
  const faltantes: Concepto[] = []
  for (const c of conceptos) {
    if (contiene(texto, c.termino)) encontrados.push(c)
    else faltantes.push(c)
  }
  return {
    encontrados,
    faltantes,
    total: conceptos.length,
    cobertura: conceptos.length === 0 ? 0 : Math.round((encontrados.length / conceptos.length) * 100),
  }
}
