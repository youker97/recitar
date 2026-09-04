// El mapa del apunte: partirlo por sus propios temas en vez de cada tantas
// letras. Un corte a mitad de una idea no sirve para estudiar.
//
// El problema real de un apunte de Derecho es que está lleno de numeración
// ("2.1.- Elementos descriptivos", "a) ...") y si se toma cada una como tema
// salen noventa temas de un archivo. Por eso los títulos se clasifican por
// jerarquía y se elige el nivel que parte el apunte en pedazos con sentido.

import type { SeccionApunte } from '../datos/tipos'
import { normalizar } from './comparar'

/** Piso absoluto: más corto que esto no es un tema. */
const LARGO_MINIMO = 250
/** Tamaño al que se apunta por tema. */
const LARGO_IDEAL = 3000
const MAXIMO_SECCIONES = 40
const TITULO_MAXIMO = 90

interface Candidato {
  titulo: string
  inicio: number
  /** 1 es el título más fuerte; 5 el más débil. */
  nivel: number
}

const MARKDOWN = /^(#{1,6})\s+(.{2,90})$/
// La numeración chilena viene como "1.-", "2.1.-", "I.-" o "a)": hay que
// aceptar varios separadores seguidos, no uno solo.
const SEPARADOR = '\\s*[.)\\-–]{1,3}\\s*'
const ROMANO = new RegExp(`^\\s*([IVXLCDM]{1,7})${SEPARADOR}(\\p{L}.{1,89})$`, 'u')
const CAPITULO = /^\s*(cap[íi]tulo|t[íi]tulo|unidad|lecci[óo]n|parte)\s+[\wíáéóú]+\s*[.:)\-–]*\s*(.{0,90})$/i
const NUMERO_SIMPLE = new RegExp(`^\\s*(\\d{1,2})${SEPARADOR}(\\p{L}.{1,89})$`, 'u')
const NUMERO_COMPUESTO = new RegExp(`^\\s*(\\d{1,2}(?:\\.\\d{1,2}){1,2})${SEPARADOR}(\\p{L}.{1,89})$`, 'u')
const LETRA = new RegExp(`^\\s*([a-zA-Z])\\s*[.)]\\s*(\\p{L}.{1,89})$`, 'u')

function letras(linea: string): number {
  return (linea.match(/\p{L}/gu) ?? []).length
}

function clasificar(linea: string, anterior: string): Candidato | null {
  const limpia = linea.trim()
  if (!limpia || limpia.length > TITULO_MAXIMO) return null
  if (letras(limpia) < 4) return null

  const md = limpia.match(MARKDOWN)
  if (md) return { titulo: md[2].trim(), inicio: 0, nivel: Math.min(2, md[1].length) }

  const cap = limpia.match(CAPITULO)
  if (cap) return { titulo: limpia.replace(/[:.]$/, ''), inicio: 0, nivel: 1 }

  // MAYÚSCULAS SOSTENIDAS: casi siempre es un título de verdad.
  if (!/\p{Ll}/u.test(limpia)) return { titulo: limpia.replace(/[:.]$/, ''), inicio: 0, nivel: 2 }

  const romano = limpia.match(ROMANO)
  if (romano && !/[.;,]$/.test(romano[2])) return { titulo: limpia, inicio: 0, nivel: 3 }

  const simple = limpia.match(NUMERO_SIMPLE)
  if (simple && !/[.;,]$/.test(simple[2])) return { titulo: limpia, inicio: 0, nivel: 3 }

  const compuesto = limpia.match(NUMERO_COMPUESTO)
  if (compuesto && !/[.;,]$/.test(compuesto[2])) return { titulo: limpia, inicio: 0, nivel: 4 }

  const letra = limpia.match(LETRA)
  if (letra && !/[.;,]$/.test(letra[2])) return { titulo: limpia, inicio: 0, nivel: 5 }

  // Línea corta, sin punto final, con un renglón en blanco antes.
  if (anterior.trim() === '' && !/[.;,:]$/.test(limpia) && limpia.split(/\s+/).length <= 9) {
    return { titulo: limpia, inicio: 0, nivel: 5 }
  }

  return null
}

/**
 * Devuelve los tramos del apunte. Si no reconoce títulos, lo parte en pedazos
 * parejos para que igual haya un mapa con el que trabajar.
 */
export function detectarSecciones(texto: string): SeccionApunte[] {
  const lineas = texto.split('\n')
  const candidatos: Candidato[] = []
  let posicion = 0

  for (let i = 0; i < lineas.length; i++) {
    const c = clasificar(lineas[i], i > 0 ? lineas[i - 1] : '')
    if (c) candidatos.push({ ...c, inicio: posicion })
    posicion += lineas[i].length + 1
  }

  if (candidatos.length === 0) return porPedazos(texto)

  // Cuántos temas tiene sentido para el largo de este apunte.
  const objetivo = Math.max(3, Math.min(MAXIMO_SECCIONES, Math.round(texto.length / LARGO_IDEAL)))

  // Se baja de nivel mientras el corte siga siendo razonable: primero solo los
  // títulos fuertes, y solo si quedan muy pocos se admiten los más débiles.
  let elegidos = candidatos.filter((c) => c.nivel <= 1)
  for (let nivel = 2; nivel <= 5; nivel++) {
    const conEste = candidatos.filter((c) => c.nivel <= nivel)
    if (elegidos.length >= 3 && conEste.length > objetivo * 1.6) break
    elegidos = conEste
    if (elegidos.length >= objetivo) break
  }
  if (elegidos.length === 0) elegidos = candidatos

  // El mínimo se adapta al largo: en un apunte corto un tema de media página
  // es legítimo; en uno de trescientas hojas, no.
  const minimo = Math.max(
    LARGO_MINIMO,
    Math.min(1500, Math.round(texto.length / Math.max(1, objetivo * 3))),
  )

  return recortar(aSecciones(elegidos, texto, minimo), texto, minimo)
}

function aSecciones(cortes: Candidato[], texto: string, minimo: number): SeccionApunte[] {
  const ordenados = [...cortes].sort((a, b) => a.inicio - b.inicio)
  if (ordenados[0].inicio > minimo) {
    ordenados.unshift({ titulo: 'Introducción', inicio: 0, nivel: 1 })
  } else {
    ordenados[0] = { ...ordenados[0], inicio: 0 }
  }
  return ordenados.map((c, i) => ({
    titulo: c.titulo,
    inicio: c.inicio,
    fin: i + 1 < ordenados.length ? ordenados[i + 1].inicio : texto.length,
    cubierta: false,
  }))
}

/** Junta los tramos muy cortos con el anterior y respeta el tope de temas. */
function recortar(secciones: SeccionApunte[], texto: string, minimo: number): SeccionApunte[] {
  const juntas: SeccionApunte[] = []
  for (const s of secciones) {
    const previa = juntas[juntas.length - 1]
    if (previa && s.fin - s.inicio < minimo) {
      previa.fin = s.fin
      continue
    }
    juntas.push({ ...s })
  }

  while (juntas.length > MAXIMO_SECCIONES) {
    let masCorta = 1
    for (let i = 1; i < juntas.length; i++) {
      if (juntas[i].fin - juntas[i].inicio < juntas[masCorta].fin - juntas[masCorta].inicio) masCorta = i
    }
    juntas[masCorta - 1].fin = juntas[masCorta].fin
    juntas.splice(masCorta, 1)
  }

  return juntas.length > 0 ? juntas : porPedazos(texto)
}

function porPedazos(texto: string): SeccionApunte[] {
  const largo = texto.length
  const cuantos = Math.max(1, Math.min(MAXIMO_SECCIONES, Math.round(largo / 2500)))
  if (cuantos <= 1) {
    return [{ titulo: 'Todo el apunte', inicio: 0, fin: largo, cubierta: false }]
  }
  const paso = Math.ceil(largo / cuantos)
  const salida: SeccionApunte[] = []
  for (let i = 0; i < cuantos; i++) {
    const inicio = i === 0 ? 0 : cortarEnParrafo(texto, i * paso)
    const fin = i + 1 === cuantos ? largo : cortarEnParrafo(texto, (i + 1) * paso)
    if (fin > inicio) salida.push({ titulo: `Parte ${i + 1}`, inicio, fin, cubierta: false })
  }
  return salida
}

/** Mueve el corte al párrafo más cercano para no partir una idea. */
function cortarEnParrafo(texto: string, cerca: number): number {
  const ventana = 600
  const desde = Math.max(0, cerca - ventana)
  const hasta = Math.min(texto.length, cerca + ventana)
  const trozo = texto.slice(desde, hasta)
  const relativo = trozo.indexOf('\n\n', cerca - desde)
  if (relativo !== -1) return desde + relativo + 2
  const anterior = trozo.lastIndexOf('\n\n', cerca - desde)
  if (anterior !== -1) return desde + anterior + 2
  return Math.min(hasta, cerca)
}

export function textoDeSeccion(texto: string, seccion: SeccionApunte): string {
  return texto.slice(seccion.inicio, seccion.fin).trim()
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

  const bajado = sinNumeracion.replace(/\p{L}[\p{L}.]*/gu, (palabra) =>
    seDejaEnMayusculas(palabra) ? palabra : palabra.toLowerCase())
  return bajado[0].toUpperCase() + bajado.slice(1)
}

/**
 * Al bajar un título GRITADO hay palabras que no se pueden tocar: "BLOQUE I"
 * quedaba como "Bloque i", y "ART. 19 CPR" como "art. 19 cpr". Se conservan
 * los números romanos y las siglas (las que no tienen vocales: CC, CP, CPR,
 * DL). Una palabra corriente, aunque sea corta, sí se baja.
 */
function seDejaEnMayusculas(palabra: string): boolean {
  const limpia = palabra.replace(/[^\p{L}]/gu, '')
  if (limpia.length === 0) return false
  if (limpia.length === 1) return true
  if (/^[IVXLCDM]+$/.test(limpia)) return true
  return !/[AEIOUÁÉÍÓÚ]/.test(limpia)
}

// ---------------------------------------------------------------------------
// El mapa que arma Claude.
//
// Claude devuelve los temas con las primeras palabras de cada uno; la app solo
// las ubica en el texto. Así el corte lo decide quien leyó el apunte, y la
// app se limita a lo que sabe hacer: buscar una posición exacta.
// ---------------------------------------------------------------------------

export interface TemaDeClaude {
  titulo: string
  empieza: string
}

export interface MapaTraido {
  secciones: SeccionApunte[]
  /** Los que Claude nombró pero no se pudieron ubicar en el texto. */
  perdidos: string[]
}

/**
 * Texto normalizado más el índice de dónde salió cada carácter, para poder
 * buscar sin tildes ni dobles espacios y volver a la posición original.
 */
function aplanar(texto: string): { plano: string; indices: number[] } {
  let plano = ''
  const indices: number[] = []
  let enBlanco = false
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (/\s/.test(c)) {
      if (enBlanco || plano.length === 0) continue
      plano += ' '
      indices.push(i)
      enBlanco = true
      continue
    }
    enBlanco = false
    const limpio = c.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    for (const l of limpio) {
      plano += l
      indices.push(i)
    }
  }
  return { plano, indices }
}

function aguja(frase: string): string {
  return aplanar(frase).plano.trim()
}

/**
 * Busca dónde empieza un tema. Si no encuentra las diez palabras completas
 * prueba con menos: Claude a veces corrige una tilde al copiar.
 */
function ubicar(plano: string, indices: number[], empieza: string, desde: number): number {
  const palabras = aguja(empieza).split(' ').filter(Boolean)
  for (let cuantas = palabras.length; cuantas >= 3; cuantas--) {
    const trozo = palabras.slice(0, cuantas).join(' ')
    if (trozo.length < 8) break
    const pos = plano.indexOf(trozo, desde)
    if (pos !== -1) return indices[pos]
    // Puede venir desordenado: se busca también desde el principio.
    const otra = plano.indexOf(trozo)
    if (otra !== -1) return indices[otra]
  }
  return -1
}

export function mapaDesdeClaude(texto: string, temas: TemaDeClaude[]): MapaTraido {
  const { plano, indices } = aplanar(texto)
  const encontrados: { titulo: string; inicio: number }[] = []
  const perdidos: string[] = []
  let cursor = 0

  for (const tema of temas) {
    const titulo = tema.titulo?.trim()
    if (!titulo) continue
    const inicio = ubicar(plano, indices, tema.empieza ?? '', cursor)
    if (inicio === -1) {
      perdidos.push(titulo)
      continue
    }
    encontrados.push({ titulo, inicio })
    const pos = plano.indexOf(aguja(tema.empieza ?? ''), cursor)
    cursor = pos === -1 ? cursor : pos + 1
  }

  if (encontrados.length === 0) return { secciones: [], perdidos }

  encontrados.sort((a, b) => a.inicio - b.inicio)
  // Ojo: acá NO se lleva el primero a 0. Con un apunte largo esto se llama una
  // vez por parte, y si cada parte empezara en 0 la parte 2 pisaría a la 1.
  // De eso se encarga fusionarSecciones, que es quien ve el mapa completo.
  const secciones: SeccionApunte[] = encontrados.map((t, i) => ({
    titulo: t.titulo,
    inicio: t.inicio,
    fin: i + 1 < encontrados.length ? encontrados[i + 1].inicio : texto.length,
    cubierta: false,
  }))

  return { secciones: secciones.filter((s) => s.fin > s.inicio), perdidos }
}

/**
 * Junta el mapa que ya había con el de una parte nueva.
 *
 * Un apunte largo no cabe en un solo pedido y va por partes. Si cada parte
 * reemplazara el mapa entero, terminar la parte 3 borraría los temas de la 1.
 * Acá se acumulan: se ordenan por dónde aparecen y se recalculan los cortes.
 */
export function fusionarSecciones(
  texto: string,
  previas: SeccionApunte[],
  nuevas: SeccionApunte[],
): SeccionApunte[] {
  const todas = [...previas, ...nuevas].sort((a, b) => a.inicio - b.inicio)
  const juntas: SeccionApunte[] = []
  for (const s of todas) {
    const ultima = juntas[juntas.length - 1]
    // El mismo tema traído dos veces: mismo nombre, o el corte prácticamente
    // en el mismo punto. Se queda el más nuevo, que es el que acaba de llegar.
    // El margen es chico a propósito: con 200 se tragaba temas vecinos de un
    // apunte apretado.
    const mismoNombre = ultima && normalizar(ultima.titulo) === normalizar(s.titulo)
    if (ultima && (mismoNombre || Math.abs(s.inicio - ultima.inicio) < 40)) {
      juntas[juntas.length - 1] = { ...s, cubierta: ultima.cubierta || s.cubierta }
      continue
    }
    juntas.push({ ...s })
  }
  if (juntas.length === 0) return []
  juntas[0].inicio = 0
  return juntas.map((s, i) => ({
    ...s,
    fin: i + 1 < juntas.length ? juntas[i + 1].inicio : texto.length,
  }))
}
