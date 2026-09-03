// Validación de los paquetes de ítems que se importan. Si el archivo viene
// malo, no se guarda nada y se dice exactamente qué línea está mala.

import { nuevoId } from './db'
import type {
  DatosItem, Item, OrigenItem, PuntoPauta, TipoItem, Verbo,
} from './tipos'
import { TIPOS_ITEM } from './tipos'

export interface ErrorImportacion {
  donde: string
  mensaje: string
}

export interface ItemEntrante {
  bloque: string
  tipo: TipoItem
  ref: string
  datos: DatosItem
  hijos: ItemEntrante[]
}

export interface ResultadoValidacion {
  ok: boolean
  curso?: string
  items: ItemEntrante[]
  errores: ErrorImportacion[]
  /** Conteo por tipo, para mostrar antes de guardar. */
  resumen: Record<string, number>
}

const VERBOS: Verbo[] = ['definir', 'posturas', 'importancia', 'distinciones']

function esTexto(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

/** La pauta acepta textos pelados o puntos con sus claves. */
function listaDePuntos(v: unknown): PuntoPauta[] | null {
  if (!Array.isArray(v)) return null
  const salida: PuntoPauta[] = []
  for (const x of v) {
    if (esTexto(x)) { salida.push({ texto: x.trim() }); continue }
    if (typeof x === 'object' && x !== null) {
      const o = x as Record<string, unknown>
      if (!esTexto(o.texto)) return null
      salida.push({ texto: o.texto.trim(), claves: listaDeTextos(o.claves) ?? undefined })
      continue
    }
    return null
  }
  return salida
}

function listaDeTextos(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null
  const limpia = v.filter((x) => esTexto(x)).map((x) => String(x).trim())
  return limpia.length === v.length ? limpia : null
}

function validarItem(
  bruto: unknown,
  donde: string,
  errores: ErrorImportacion[],
  bloquePadre: string,
): ItemEntrante | null {
  if (typeof bruto !== 'object' || bruto === null) {
    errores.push({ donde, mensaje: 'no es un objeto' })
    return null
  }
  const o = bruto as Record<string, unknown>
  const tipo = o.tipo

  if (!esTexto(tipo) || !TIPOS_ITEM.includes(tipo as TipoItem)) {
    errores.push({
      donde,
      mensaje: `"tipo" debe ser uno de: ${TIPOS_ITEM.join(', ')}${esTexto(tipo) ? ` (llegó "${tipo}")` : ''}`,
    })
    return null
  }

  const bloque = esTexto(o.bloque) ? o.bloque.trim() : bloquePadre
  if (!bloque) {
    errores.push({ donde, mensaje: 'falta "bloque" (la materia a la que pertenece)' })
    return null
  }
  const ref = esTexto(o.ref) ? o.ref.trim() : ''

  let datos: DatosItem | null = null
  const falta = (campo: string, detalle = '') =>
    errores.push({ donde, mensaje: `falta "${campo}"${detalle ? ` ${detalle}` : ''}` })

  switch (tipo as TipoItem) {
    case 'vf': {
      if (!esTexto(o.pregunta)) falta('pregunta')
      if (typeof o.esVerdadera !== 'boolean') falta('esVerdadera', '(true o false, sin comillas)')
      if (!esTexto(o.justificacion)) falta('justificacion')
      if (esTexto(o.pregunta) && typeof o.esVerdadera === 'boolean' && esTexto(o.justificacion)) {
        datos = {
          pregunta: o.pregunta.trim(),
          esVerdadera: o.esVerdadera,
          justificacion: o.justificacion.trim(),
          claves: listaDeTextos(o.claves) ?? undefined,
        }
      }
      break
    }
    case 'alternativas': {
      const opciones = listaDeTextos(o.opciones)
      if (!esTexto(o.pregunta)) falta('pregunta')
      if (!opciones) falta('opciones', '(una lista de textos, sin vacíos)')
      else if (opciones.length < 3) errores.push({ donde, mensaje: '"opciones" necesita al menos 3' })
      const correcta = Number(o.correcta)
      if (!Number.isInteger(correcta) || correcta < 0 || (opciones && correcta >= opciones.length)) {
        errores.push({
          donde,
          mensaje: '"correcta" debe ser el número de la opción correcta, partiendo de 0',
        })
      } else if (opciones && opciones.length >= 3 && esTexto(o.pregunta)) {
        datos = {
          pregunta: o.pregunta.trim(),
          opciones,
          correcta,
          explicacion: esTexto(o.explicacion) ? o.explicacion.trim() : '',
        }
      }
      break
    }
    case 'lista': {
      const elementos = listaDeTextos(o.elementos)
      if (!esTexto(o.titulo)) falta('titulo')
      if (!elementos) falta('elementos', '(una lista de textos, sin vacíos)')
      else if (elementos.length < 2) errores.push({ donde, mensaje: '"elementos" necesita al menos 2' })
      if (esTexto(o.titulo) && elementos && elementos.length >= 2) {
        datos = {
          titulo: o.titulo.trim(),
          articulo: esTexto(o.articulo) ? o.articulo.trim() : undefined,
          elementos,
          ordenImporta: o.ordenImporta === true,
        }
      }
      break
    }
    case 'articulo': {
      if (!esTexto(o.numero)) falta('numero')
      if (!esTexto(o.materia)) falta('materia')
      if (esTexto(o.numero) && esTexto(o.materia)) {
        datos = {
          numero: o.numero.trim(),
          materia: o.materia.trim(),
          cuerpo: esTexto(o.cuerpo) ? o.cuerpo.trim() : undefined,
        }
      }
      break
    }
    case 'textoLegal': {
      if (!esTexto(o.numero)) falta('numero')
      if (!esTexto(o.textoLiteral)) falta('textoLiteral')
      else if (o.textoLiteral.trim().split(/\s+/).length < 8) {
        errores.push({ donde, mensaje: '"textoLiteral" es muy corto para hacer huecos (mínimo 8 palabras)' })
      }
      if (esTexto(o.numero) && esTexto(o.textoLiteral) && o.textoLiteral.trim().split(/\s+/).length >= 8) {
        datos = { numero: o.numero.trim(), textoLiteral: o.textoLiteral.trim() }
      }
      break
    }
    case 'triaje': {
      if (!esTexto(o.enunciado)) falta('enunciado')
      if (!esTexto(o.verbo) || !VERBOS.includes(o.verbo as Verbo)) {
        errores.push({ donde, mensaje: `"verbo" debe ser uno de: ${VERBOS.join(', ')}` })
      }
      if (esTexto(o.enunciado) && esTexto(o.verbo) && VERBOS.includes(o.verbo as Verbo)) {
        datos = { enunciado: o.enunciado.trim(), bloque, verbo: o.verbo as Verbo }
      }
      break
    }
    case 'desarrollo': {
      const checklist = listaDePuntos(o.checklist)
      if (!esTexto(o.enunciado)) falta('enunciado')
      if (!checklist) falta('checklist', '(la pauta: textos, o {"texto":"...","claves":["..."]})')
      else if (checklist.length < 2) errores.push({ donde, mensaje: '"checklist" necesita al menos 2 puntos' })
      if (esTexto(o.enunciado) && checklist && checklist.length >= 2) {
        datos = {
          enunciado: o.enunciado.trim(),
          checklist,
          minutosSugeridos:
            typeof o.minutosSugeridos === 'number' && o.minutosSugeridos > 0
              ? o.minutosSugeridos
              : undefined,
        }
      }
      break
    }
    case 'repregunta': {
      if (!esTexto(o.pregunta)) falta('pregunta')
      if (!esTexto(o.respuesta)) falta('respuesta')
      if (esTexto(o.pregunta) && esTexto(o.respuesta)) {
        datos = { pregunta: o.pregunta.trim(), respuesta: o.respuesta.trim() }
      }
      break
    }
  }

  if (!datos) return null

  const hijos: ItemEntrante[] = []
  if (o.hijos !== undefined) {
    if (!Array.isArray(o.hijos)) {
      errores.push({ donde, mensaje: '"hijos" debe ser una lista de repreguntas' })
    } else {
      o.hijos.forEach((h, k) => {
        const hijo = validarItem(h, `${donde} › repregunta ${k + 1}`, errores, bloque)
        if (hijo) hijos.push(hijo)
      })
    }
  }

  return { bloque, tipo: tipo as TipoItem, ref, datos, hijos }
}

export function validarPaquete(bruto: unknown): ResultadoValidacion {
  const errores: ErrorImportacion[] = []
  const items: ItemEntrante[] = []

  if (typeof bruto !== 'object' || bruto === null || Array.isArray(bruto)) {
    if (Array.isArray(bruto)) {
      // Se acepta una lista pelada de ítems.
      bruto.forEach((x, i) => {
        const item = validarItem(x, `ítem ${i + 1}`, errores, '')
        if (item) items.push(item)
      })
      return terminar(undefined, items, errores)
    }
    errores.push({ donde: 'archivo', mensaje: 'el archivo no contiene un objeto JSON válido' })
    return terminar(undefined, items, errores)
  }

  const o = bruto as Record<string, unknown>
  if (!Array.isArray(o.items)) {
    errores.push({ donde: 'archivo', mensaje: 'falta la lista "items"' })
    return terminar(esTexto(o.curso) ? o.curso : undefined, items, errores)
  }

  o.items.forEach((x, i) => {
    const item = validarItem(x, `ítem ${i + 1}`, errores, '')
    if (item) items.push(item)
  })

  return terminar(esTexto(o.curso) ? o.curso.trim() : undefined, items, errores)
}

function terminar(
  curso: string | undefined,
  items: ItemEntrante[],
  errores: ErrorImportacion[],
): ResultadoValidacion {
  const resumen: Record<string, number> = {}
  const contar = (lista: ItemEntrante[]) => {
    for (const i of lista) {
      resumen[i.tipo] = (resumen[i.tipo] ?? 0) + 1
      contar(i.hijos)
    }
  }
  contar(items)
  if (items.length === 0 && errores.length === 0) {
    errores.push({ donde: 'archivo', mensaje: 'no hay ningún ítem que importar' })
  }
  return { ok: errores.length === 0 && items.length > 0, curso, items, errores, resumen }
}

/** Convierte lo validado en ítems guardables, resolviendo las cadenas. */
export function aItems(
  entrantes: ItemEntrante[],
  cursoId: string,
  origen: OrigenItem = 'json',
): Item[] {
  const salida: Item[] = []
  const ahora = Date.now()

  const recorrer = (lista: ItemEntrante[], padreId?: string) => {
    lista.forEach((entrante, orden) => {
      const item: Item = {
        id: nuevoId(),
        cursoId,
        bloque: entrante.bloque,
        tipo: entrante.tipo,
        datos: entrante.datos,
        ref: entrante.ref,
        padreId,
        orden,
        origen,
        creadoEn: ahora,
        actualizadoEn: ahora,
      }
      salida.push(item)
      if (entrante.hijos.length > 0) recorrer(entrante.hijos, item.id)
    })
  }

  recorrer(entrantes)
  return salida
}
