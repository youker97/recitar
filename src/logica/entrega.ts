// Abrir una entrega de Claude y dejar cada cosa en su lugar.
//
// Una entrega trae temas y las cosas de esos temas mezcladas: vocabulario y
// preguntas. La app las reparte: los temas van al mapa del apunte, y cada
// pregunta o palabra al tema que le corresponde, calzando por el título.
//
// Lo que no calza no se pierde ni se inventa: se cuenta y se avisa.

import type { Item, SeccionApunte } from '../datos/tipos'
import { validarPaquete, aItems, type ErrorImportacion } from '../datos/esquema'
import { fusionarSecciones, mapaDesdeClaude, type TemaDeClaude } from './mapa'
import { normalizar } from './comparar'

export interface Entrega {
  /** Número que puso Claude, para saber por dónde va. */
  numero?: number
  total?: number
  secciones: SeccionApunte[]
  items: Item[]
  /** Temas que Claude nombró pero no se pudieron ubicar en el texto. */
  perdidos: string[]
  /** Ítems cuya "seccion" no calza con ningún tema conocido. */
  sinTema: number
  errores: ErrorImportacion[]
}

export interface Descarga {
  texto: string
  cursoId: string
  bloque: string
  /** El apunte donde se ubican los temas. */
  fuenteTexto: string
  /** Los temas que ya existían, para que la entrega se sume y no reemplace. */
  previas: SeccionApunte[]
}

/**
 * Lee lo que trajo el camión. No guarda nada: devuelve lo que habría que
 * guardar, para que la pantalla decida y pueda avisar antes.
 */
export function abrirEntrega(d: Descarga): Entrega | { error: string } {
  let bruto: Record<string, unknown>
  try {
    bruto = JSON.parse(d.texto)
  } catch {
    return { error: 'Eso no es JSON válido. Copia el bloque de código completo.' }
  }
  if (!bruto || typeof bruto !== 'object') {
    return { error: 'La respuesta no trae un paquete de Recitar.' }
  }

  // --- los temas ---
  const crudos = Array.isArray(bruto.temas) ? bruto.temas : []
  const temas: TemaDeClaude[] = (crudos as { titulo?: unknown; empieza?: unknown }[])
    .filter((t) => typeof t?.titulo === 'string' && typeof t?.empieza === 'string')
    .map((t) => ({ titulo: String(t.titulo).trim(), empieza: String(t.empieza) }))

  const traido = temas.length > 0
    ? mapaDesdeClaude(d.fuenteTexto, temas)
    : { secciones: [], perdidos: [] }
  const secciones = temas.length > 0
    ? fusionarSecciones(d.fuenteTexto, d.previas, traido.secciones)
    : d.previas

  // --- las preguntas y las palabras ---
  const entrantes = Array.isArray(bruto.items) ? bruto.items : []
  const conBloque = (entrantes as unknown[]).map((i) =>
    i && typeof i === 'object' ? { ...(i as object), bloque: d.bloque } : i)
  const validado = validarPaquete({ items: conBloque })

  // Cada ítem va al tema cuyo título calce. Los títulos los puso Claude en la
  // misma respuesta, así que casi siempre calzan; si no, el ítem igual se
  // guarda con su bloque y se avisa.
  const porTitulo = new Map(secciones.map((s) => [normalizar(s.titulo), s.titulo]))
  let sinTema = 0
  // Ojo: los identificadores los pone aItems y son los que enlazan cada
  // repregunta con su padre. Reasignarlos acá rompía la cadena entera.
  const items = aItems(validado.items, d.cursoId, 'json').map((item) => {
    const propuesta = item.seccion ? porTitulo.get(normalizar(item.seccion)) : undefined
    if (item.seccion && !propuesta && !item.padreId) sinTema++
    return { ...item, bloque: d.bloque, seccion: propuesta ?? item.seccion }
  })

  if (secciones.length === d.previas.length && items.length === 0) {
    return { error: 'La entrega no trae ni temas ni preguntas que se puedan usar.' }
  }

  return {
    numero: typeof bruto.entrega === 'number' ? bruto.entrega : undefined,
    total: typeof bruto.de === 'number' ? bruto.de : undefined,
    secciones,
    items,
    perdidos: traido.perdidos,
    sinTema,
    errores: validado.errores,
  }
}

/** Cuenta lo que trajo la entrega, para decírselo al que la pegó. */
export function resumirEntrega(e: Entrega, previas: number): string {
  const partes: string[] = []
  const temasNuevos = e.secciones.length - previas
  if (temasNuevos > 0) partes.push(`${temasNuevos} ${temasNuevos === 1 ? 'tema' : 'temas'}`)
  const palabras = e.items.filter((i) => i.tipo === 'concepto').length
  const preguntas = e.items.filter((i) => i.tipo !== 'concepto' && !i.padreId).length
  const repreguntas = e.items.filter((i) => i.padreId).length
  if (palabras > 0) partes.push(`${palabras} ${palabras === 1 ? 'palabra' : 'palabras'}`)
  if (preguntas > 0) partes.push(`${preguntas} ${preguntas === 1 ? 'pregunta' : 'preguntas'}`)
  if (repreguntas > 0) partes.push(`${repreguntas} ${repreguntas === 1 ? 'repregunta' : 'repreguntas'}`)
  if (partes.length === 0) return 'La entrega llegó vacía.'

  const cabeza = e.numero
    ? `Entrega ${e.numero}${e.total ? ` de ${e.total}` : ''}: `
    : 'Recibido: '
  return cabeza + partes.join(', ') + '.'
}
