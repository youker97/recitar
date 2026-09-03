import type {
  DatosArticulo, DatosDesarrollo, DatosLista, DatosRepregunta,
  DatosTextoLegal, DatosTriaje, DatosVF, Item,
} from '../datos/tipos'

/** Una línea que identifica al ítem en listados. */
export function resumenDeItem(item: Item): string {
  switch (item.tipo) {
    case 'vf': return (item.datos as DatosVF).pregunta
    case 'lista': return (item.datos as DatosLista).titulo
    case 'articulo': {
      const d = item.datos as DatosArticulo
      return `Art. ${d.numero} — ${d.materia}`
    }
    case 'textoLegal': {
      const d = item.datos as DatosTextoLegal
      return `Art. ${d.numero} (texto literal)`
    }
    case 'triaje': return (item.datos as DatosTriaje).enunciado
    case 'desarrollo': return (item.datos as DatosDesarrollo).enunciado
    case 'repregunta': return (item.datos as DatosRepregunta).pregunta
    default: return '(ítem)'
  }
}
