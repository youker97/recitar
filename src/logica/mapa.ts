// El mapa del apunte: partirlo por sus propios temas en vez de cada tantas
// letras. Un corte a mitad de una idea no sirve para estudiar.

import type { SeccionApunte } from '../datos/tipos'

const LARGO_MINIMO = 220
const TITULO_MAXIMO = 90

const MARKDOWN = /^#{1,6}\s+(.{2,90})$/
const NUMERADO = /^\s*(?:[IVXLCDM]{1,7}|\d{1,2}(?:\.\d{1,2}){0,2}|[a-zA-Z])\s*[.)\-–]\s+(.{2,90})$/

function tieneMinusculas(linea: string): boolean {
  return /\p{Ll}/u.test(linea)
}

function cuentaLetras(linea: string): number {
  return (linea.match(/\p{L}/gu) ?? []).length
}

function esTitulo(linea: string, anterior: string): string | null {
  const limpia = linea.trim()
  if (!limpia || limpia.length > TITULO_MAXIMO) return null

  const md = limpia.match(MARKDOWN)
  if (md) return md[1].trim()

  const num = limpia.match(NUMERADO)
  if (num && !/[.;,]$/.test(num[1])) return num[1].trim()

  const letras = cuentaLetras(limpia)
  if (letras < 4) return null

  // MAYÚSCULAS SOSTENIDAS.
  if (!tieneMinusculas(limpia) && letras >= 4) return limpia.replace(/[:.]$/, '')

  // Línea corta, sin punto final, con un renglón en blanco antes.
  const sola = anterior.trim() === ''
  if (sola && !/[.;,:]$/.test(limpia) && limpia.split(/\s+/).length <= 9) {
    return limpia
  }

  return null
}

/**
 * Devuelve los tramos del apunte. Si no reconoce títulos, lo parte en pedazos
 * parejos para que igual haya un mapa con el que trabajar.
 */
export function detectarSecciones(texto: string): SeccionApunte[] {
  const lineas = texto.split('\n')
  const cortes: { titulo: string; inicio: number }[] = []
  let posicion = 0

  for (let i = 0; i < lineas.length; i++) {
    const titulo = esTitulo(lineas[i], i > 0 ? lineas[i - 1] : '')
    if (titulo) cortes.push({ titulo, inicio: posicion })
    posicion += lineas[i].length + 1
  }

  if (cortes.length === 0 || (cortes.length === 1 && cortes[0].inicio > texto.length / 2)) {
    return porPedazos(texto)
  }

  // El texto antes del primer título no se pierde.
  if (cortes[0].inicio > LARGO_MINIMO) {
    cortes.unshift({ titulo: 'Introducción', inicio: 0 })
  } else {
    cortes[0].inicio = 0
  }

  const crudas: SeccionApunte[] = cortes.map((c, i) => ({
    titulo: c.titulo,
    inicio: c.inicio,
    fin: i + 1 < cortes.length ? cortes[i + 1].inicio : texto.length,
    cubierta: false,
  }))

  // Un título pegado a otro título no es una sección: se junta con la anterior.
  const juntas: SeccionApunte[] = []
  for (const s of crudas) {
    const previa = juntas[juntas.length - 1]
    if (previa && s.fin - s.inicio < LARGO_MINIMO) {
      previa.fin = s.fin
      continue
    }
    juntas.push({ ...s })
  }

  if (juntas.length === 0) return porPedazos(texto)
  return juntas
}

function porPedazos(texto: string): SeccionApunte[] {
  const largo = texto.length
  const cuantos = Math.max(1, Math.min(8, Math.round(largo / 2500)))
  if (cuantos <= 1) {
    return [{ titulo: 'Todo el apunte', inicio: 0, fin: largo, cubierta: false }]
  }
  const paso = Math.ceil(largo / cuantos)
  const salida: SeccionApunte[] = []
  for (let i = 0; i < cuantos; i++) {
    const inicio = i === 0 ? 0 : cortarEnParrafo(texto, i * paso)
    const fin = i + 1 === cuantos ? largo : cortarEnParrafo(texto, (i + 1) * paso)
    if (fin > inicio) {
      salida.push({ titulo: `Parte ${i + 1}`, inicio, fin, cubierta: false })
    }
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
