// Convierte apuntes en .md o .txt a ítems, con marcas simples.
// Lo que no reconoce no se pierde: queda listado aparte para mandárselo a
// Claude o para escribirlo a mano.

import type { ItemEntrante } from '../datos/esquema'
import type { Verbo } from '../datos/tipos'

export interface ResultadoApunte {
  items: ItemEntrante[]
  /** Líneas que no se pudieron convertir. */
  restos: string[]
}

const VERBOS: Verbo[] = ['definir', 'posturas', 'importancia', 'distinciones']

function sacarRef(texto: string): { texto: string; ref: string } {
  const m = texto.match(/\[([^\]]+)\]\s*$/)
  if (!m) return { texto: texto.trim(), ref: '' }
  return { texto: texto.slice(0, m.index).trim(), ref: m[1].trim() }
}

function limpiarMarkdown(linea: string): string {
  return linea
    .replace(/\*\*/g, '')
    .replace(/__/g, '')
    .replace(/`/g, '')
    .trim()
}

export function convertirApunte(fuente: string): ResultadoApunte {
  const lineas = fuente.split(/\r?\n/).map(limpiarMarkdown)
  const items: ItemEntrante[] = []
  const restos: string[] = []
  let bloque = 'Sin bloque'
  let refActual = ''
  const estado: { ultimo: ItemEntrante | null } = { ultimo: null }
  let preguntaColgando: { pregunta: string; ref: string } | null = null

  const nuevo = (item: ItemEntrante) => {
    items.push(item)
    estado.ultimo = item
    return item
  }

  const esViñeta = (l: string) => /^[-*•]\s+/.test(l)
  const contenidoViñeta = (l: string) => l.replace(/^[-*•]\s+/, '').trim()

  for (let i = 0; i < lineas.length; i++) {
    const cruda = lineas[i]
    const linea = cruda.trim()
    if (!linea) continue

    // Encabezado: cambia el bloque.
    const encabezado = linea.match(/^#{1,6}\s+(.+)$/)
    if (encabezado) {
      bloque = encabezado[1].replace(/[:#]+$/, '').trim()
      refActual = ''
      estado.ultimo = null
      continue
    }

    // Referencia suelta para lo que viene.
    const refSola = linea.match(/^\[(.+)\]$/)
    if (refSola) { refActual = refSola[1].trim(); continue }

    // Verdadero / falso.
    const vf = linea.match(/^([VF])\s*[:.]\s*(.+)$/i)
    if (vf) {
      const { texto: pregunta, ref } = sacarRef(vf[2])
      let justificacion = ''
      let refJ = ''
      const siguiente = (lineas[i + 1] ?? '').trim()
      const conJ = siguiente.match(/^J\s*[:.]\s*(.+)$/i)
      if (conJ) {
        const salida = sacarRef(conJ[1])
        justificacion = salida.texto
        refJ = salida.ref
        i++
      }
      if (!justificacion) { restos.push(`${linea}   (le falta la justificación con J:)`); continue }
      nuevo({
        bloque,
        tipo: 'vf',
        ref: refJ || ref || refActual,
        datos: { pregunta, esVerdadera: vf[1].toUpperCase() === 'V', justificacion },
        hijos: [],
      })
      continue
    }

    // Repregunta: ? pregunta / = respuesta
    const pregunta = linea.match(/^\?\s*(.+)$/)
    if (pregunta) {
      const { texto, ref } = sacarRef(pregunta[1])
      preguntaColgando = { pregunta: texto, ref }
      continue
    }
    const respuesta = linea.match(/^=\s*(.+)$/)
    if (respuesta && preguntaColgando) {
      const { texto, ref } = sacarRef(respuesta[1])
      const hija: ItemEntrante = {
        bloque,
        tipo: 'repregunta',
        ref: ref || preguntaColgando.ref || refActual,
        datos: { pregunta: preguntaColgando.pregunta, respuesta: texto },
        hijos: [],
      }
      if (estado.ultimo) estado.ultimo.hijos.push(hija)
      else items.push(hija)
      preguntaColgando = null
      continue
    }

    // Lista contada.
    const lista = linea.match(/^(?:LISTA|L)\s*[:.]\s*(.+)$/i)
    if (lista) {
      const { texto: titulo, ref } = sacarRef(lista[1])
      const elementos: string[] = []
      while (i + 1 < lineas.length && esViñeta(lineas[i + 1].trim())) {
        elementos.push(contenidoViñeta(lineas[++i].trim()))
      }
      if (elementos.length < 2) { restos.push(`${linea}   (necesita al menos 2 elementos con guiones)`); continue }
      nuevo({ bloque, tipo: 'lista', ref: ref || refActual, datos: { titulo, elementos }, hijos: [] })
      continue
    }

    // Artículo: ART 1489: de qué trata
    const articulo = linea.match(/^(?:ART|ARTICULO|ARTÍCULO|A)\.?\s*([\wº°.-]+)\s*[:—–-]\s*(.+)$/i)
    if (articulo) {
      const { texto: materia, ref } = sacarRef(articulo[2])
      nuevo({
        bloque, tipo: 'articulo', ref: ref || refActual,
        datos: { numero: articulo[1].trim(), materia }, hijos: [],
      })
      continue
    }

    // Texto legal literal: TEXTO 1545: Todo contrato...
    const textoLegal = linea.match(/^(?:TEXTO|T)\.?\s*([\wº°.-]+)\s*[:]\s*(.+)$/i)
    if (textoLegal) {
      let literal = textoLegal[2]
      while (
        i + 1 < lineas.length &&
        lineas[i + 1].trim() &&
        !/^([VF]\s*[:.]|\?|=|#|\[|LISTA|L\s*:|ART|TEXTO|DES|TRIAJE)/i.test(lineas[i + 1].trim())
      ) {
        literal += ' ' + lineas[++i].trim()
      }
      const { texto, ref } = sacarRef(literal)
      if (texto.split(/\s+/).length < 8) { restos.push(`${linea}   (el texto es muy corto)`); continue }
      nuevo({
        bloque, tipo: 'textoLegal', ref: ref || refActual,
        datos: { numero: textoLegal[1].trim(), textoLiteral: texto }, hijos: [],
      })
      continue
    }

    // Desarrollo con pauta.
    const desarrollo = linea.match(/^(?:DES|DESARROLLO|D)\s*[:.]\s*(.+)$/i)
    if (desarrollo) {
      const { texto: enunciado, ref } = sacarRef(desarrollo[1])
      const checklist: string[] = []
      while (i + 1 < lineas.length && esViñeta(lineas[i + 1].trim())) {
        checklist.push(contenidoViñeta(lineas[++i].trim()))
      }
      if (checklist.length < 2) { restos.push(`${linea}   (necesita una pauta de al menos 2 puntos)`); continue }
      nuevo({ bloque, tipo: 'desarrollo', ref: ref || refActual, datos: { enunciado, checklist }, hijos: [] })
      continue
    }

    // Triaje: TRIAJE(posturas): enunciado
    const triaje = linea.match(/^TRIAJE\s*\(([a-zá-ú]+)\)\s*[:.]\s*(.+)$/i)
    if (triaje) {
      const verbo = triaje[1].toLowerCase() as Verbo
      if (!VERBOS.includes(verbo)) { restos.push(`${linea}   (verbo desconocido: usa ${VERBOS.join(', ')})`); continue }
      const { texto: enunciado, ref } = sacarRef(triaje[2])
      nuevo({ bloque, tipo: 'triaje', ref: ref || refActual, datos: { enunciado, bloque, verbo }, hijos: [] })
      continue
    }

    restos.push(linea)
  }

  return { items, restos }
}
