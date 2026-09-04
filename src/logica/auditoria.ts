// Revisar contra el apunte lo que llegó de Claude.
//
// Un modelo se equivoca de una forma característica: trae cosas ciertas que
// NO están en tu apunte. Una definición de manual, un artículo que se sabe de
// memoria, una frase "citada" que en realidad parafraseó. Puede ser correcto
// en el aire y ser inútil para tu prueba, porque tu profesor evalúa de SU
// apunte.
//
// Eso sí se puede comprobar sin entender nada: es comparar textos. Lo que no
// se puede comprobar acá es si la doctrina está bien; para eso la app marca
// cuáles revisar, para que no haya que revisar las doscientas.

import type {
  DatosArticulo, DatosConcepto, DatosLista, DatosTextoLegal, DatosVF, Item,
} from '../datos/tipos'
import { contiene, normalizar } from './comparar'
import { resumenDeItem } from './resumen'

/** Un artículo nombrado en el texto: "art. 1489", "artículo 10 N°4". */
const ARTICULO = /\barts?\.?\s*(\d{1,4})|\bart[íi]culos?\s+(\d{1,4})/gi

function articulosDe(texto: string): Set<string> {
  const salida = new Set<string>()
  for (const m of texto.matchAll(ARTICULO)) salida.add(m[1] ?? m[2])
  return salida
}

export interface Reparo {
  itemId: string
  /** Qué se le encontró, en cristiano. */
  motivos: string[]
}

/**
 * Compara cada ítem con el texto del apunte del que dice venir.
 *
 * Marcar no es decir que esté mal: es decir "esto no salió de tu apunte,
 * míralo". Por eso los motivos se escriben así y no como errores.
 */
export function auditar(items: Item[], textoApunte: string): Reparo[] {
  const salida: Reparo[] = []
  const articulos = articulosDe(textoApunte)
  const vistos = new Map<string, string>()

  for (const item of items) {
    const motivos: string[] = []

    // Repetido: la misma pregunta dos veces cansa y falsea el avance.
    const huella = normalizar(resumenDeItem(item))
    if (huella.length > 8) {
      if (vistos.has(huella)) motivos.push('Está repetido en esta misma entrega.')
      else vistos.set(huella, item.id)
    }

    switch (item.tipo) {
      case 'concepto': {
        const d = item.datos as DatosConcepto
        if (!contiene(textoApunte, d.termino)) {
          motivos.push(`"${d.termino}" no aparece en el apunte.`)
        }
        // La frase "copiada tal cual" es la más fácil de inventar sin querer.
        if (d.contexto && !contiene(textoApunte, d.contexto, 0.78)) {
          motivos.push('La frase que cita como del apunte no está en el texto.')
        }
        break
      }
      case 'textoLegal': {
        const d = item.datos as DatosTextoLegal
        if (!contiene(textoApunte, d.textoLiteral, 0.78)) {
          motivos.push('El texto literal del artículo no está en el apunte: lo trajo de memoria.')
        }
        break
      }
      case 'articulo': {
        const d = item.datos as DatosArticulo
        const numero = (d.numero.match(/\d{1,4}/) ?? [])[0]
        if (numero && !articulos.has(numero)) {
          motivos.push(`El apunte no nombra el art. ${numero}.`)
        }
        break
      }
      case 'lista': {
        const d = item.datos as DatosLista
        const fuera = d.elementos.filter((e) => !contiene(textoApunte, e, 0.8))
        if (fuera.length > d.elementos.length / 2) {
          motivos.push(`${fuera.length} de ${d.elementos.length} elementos no están en el apunte.`)
        }
        break
      }
      case 'vf': {
        const d = item.datos as DatosVF
        for (const clave of d.claves ?? []) {
          const numero = (clave.match(/^\d{3,4}$/) ?? [])[0]
          if (numero && !articulos.has(numero)) {
            motivos.push(`La justificación se apoya en el art. ${numero}, que el apunte no nombra.`)
            break
          }
        }
        break
      }
      default:
        break
    }

    if (motivos.length > 0) salida.push({ itemId: item.id, motivos })
  }

  return salida
}
