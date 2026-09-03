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
