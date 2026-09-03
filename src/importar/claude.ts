// El puente con Claude. La app no llama a ninguna API: arma el pedido
// completo para pegarlo en Claude y después recibe el JSON de vuelta.

export interface TrozoTexto {
  numero: number
  total: number
  texto: string
}

const LARGO_TROZO = 6000

/** Parte el apunte en trozos que quepan cómodos en una conversación. */
export function partirTexto(texto: string, largo = LARGO_TROZO): TrozoTexto[] {
  const limpio = texto.trim()
  if (limpio.length <= largo) return [{ numero: 1, total: 1, texto: limpio }]

  const parrafos = limpio.split(/\n\s*\n/)
  const trozos: string[] = []
  let actual = ''
  for (const p of parrafos) {
    if (actual && actual.length + p.length + 2 > largo) {
      trozos.push(actual.trim())
      actual = ''
    }
    if (p.length > largo) {
      // Un párrafo gigante se corta por oraciones.
      const oraciones = p.split(/(?<=[.;:])\s+/)
      for (const o of oraciones) {
        if (actual.length + o.length + 1 > largo) { trozos.push(actual.trim()); actual = '' }
        actual += o + ' '
      }
    } else {
      actual += (actual ? '\n\n' : '') + p
    }
  }
  if (actual.trim()) trozos.push(actual.trim())

  return trozos.map((t, i) => ({ numero: i + 1, total: trozos.length, texto: t }))
}

export interface OpcionesPedido {
  curso: string
  bloques: string[]
  trozo: TrozoTexto
  /** Si la prueba es oral, se piden más repreguntas y desarrollos. */
  orientacionOral: boolean
}

const ESQUEMA = `{
  "recitar": 1,
  "curso": "<nombre del curso>",
  "items": [ ... ]
}

Cada ítem es un objeto con "tipo", "bloque", "seccion", "ref" y los campos de su tipo.
"bloque" es el tema grande (la unidad del curso) y "seccion" es el subtema exacto del apunte del
que salió, copiado tal cual del título que aparece en el texto: con eso la app sabe qué materia ya
pasaste y qué no.

- {"tipo":"vf","bloque":"","ref":"","pregunta":"","esVerdadera":true|false,"justificacion":"","claves":["término 1","término 2"]}
- {"tipo":"alternativas","bloque":"","ref":"","pregunta":"","opciones":["a","b","c","d"],"correcta":0,"explicacion":"por qué esa y por qué no las otras"}
- {"tipo":"lista","bloque":"","ref":"","titulo":"","articulo":"(opcional)","elementos":["","",""]}
- {"tipo":"articulo","bloque":"","ref":"","numero":"1489","materia":"de qué trata","cuerpo":"Código Civil"}
- {"tipo":"textoLegal","bloque":"","ref":"","numero":"1545","textoLiteral":"el texto exacto, sin resumir"}
- {"tipo":"triaje","bloque":"","ref":"","enunciado":"","verbo":"definir|posturas|importancia|distinciones"}
- {"tipo":"desarrollo","bloque":"","ref":"","enunciado":"","minutosSugeridos":10,
   "checklist":[{"texto":"punto de la pauta","claves":["término que debe aparecer","1489"]}]}
- {"tipo":"repregunta","bloque":"","ref":"","pregunta":"","respuesta":""}

Cualquier ítem puede llevar "hijos": [ ...repreguntas... ], y esas repreguntas
pueden llevar sus propios "hijos". Así se arma la cadena.`

export function armarPedido(o: OpcionesPedido): string {
  const { curso, bloques, trozo, orientacionOral } = o
  const conBloques = bloques.length
    ? `Usa preferentemente estos bloques, que ya existen en mi curso: ${bloques.join(', ')}. Si el texto trata de otra cosa, crea un bloque nuevo con un nombre corto.`
    : 'Agrupa los ítems en bloques con nombres cortos (la unidad o el tema al que pertenecen).'

  return `Estoy estudiando Derecho en Chile y uso una app llamada Recitar, que me obliga a producir
la materia de memoria en vez de releerla. Necesito que conviertas el material que te paso al
formato de Recitar.

Curso: ${curso}
${conBloques}
${trozo.total > 1 ? `Esta es la parte ${trozo.numero} de ${trozo.total} del apunte.` : ''}

FORMATO DE SALIDA (JSON, y nada más que el JSON):
${ESQUEMA}

CÓMO QUIERO LOS ÍTEMS:
1. Nada de preguntas que se contesten reconociendo. Todas deben poder responderse en voz alta,
   produciendo la respuesta completa.
2. Los verdadero/falso apuntan a la confusión típica, no a la obviedad. La justificación va en
   dos o tres líneas, con la razón y la norma.
3. Cada enumeración legal del texto se convierte en un ítem "lista" con todos sus elementos.
4. Los artículos que conviene saber de memoria van como "textoLegal" con el texto literal exacto,
   sin resumir ni corregir la redacción.
5. Los artículos que basta ubicar van como "articulo" (número ↔ materia).
6. Las preguntas de examen que aparezcan en el texto van como "triaje".
7. Las preguntas grandes van como "desarrollo" con una pauta de 4 a 8 puntos concretos: cada punto
   debe ser algo verificable que yo dije o no dije.
7.1 IMPORTANTE — cada punto de la pauta lleva "claves": de 1 a 3 términos exactos que tienen que
   aparecer sí o sí en una respuesta bien dada (el nombre técnico de la institución, el número del
   artículo, la palabra que no se puede reemplazar). Con eso la app corrige sola cuando no tengo
   internet. No pongas como clave palabras genéricas ("explica", "importante", "derecho").
7.2 Los "vf" también llevan "claves": los 2 a 4 términos que tiene que traer la justificación.
7.3 Las de "alternativas" llevan 4 opciones con distractores creíbles del mismo ramo (confusiones
   típicas, no opciones absurdas). "correcta" es el índice, partiendo de 0.
8. ${orientacionOral
    ? 'La prueba es ORAL: cada ítem importante lleva de 2 a 4 repreguntas en "hijos", encadenadas, cada una más honda que la anterior, como el profesor que sigue raspando después de la primera respuesta. Incluye al menos una repregunta que ataque la excepción o el caso límite.'
    : 'Los ítems importantes llevan 1 a 3 repreguntas en "hijos", encadenadas, cada una más honda que la anterior.'}
8.1 "seccion" va en TODOS los ítems, con el título del tramo del apunte del que salieron, escrito
   igual que en el texto. Si el apunte no tiene títulos, inventa uno corto y úsalo consistentemente
   para todos los ítems de ese tramo.
9. "ref" siempre lleva de dónde sale (artículo, autor, número de clase o página). Si no se puede
   saber del texto, deja "ref" con el tema.
10. No inventes contenido que no esté en el texto. Si algo está incompleto, omítelo en vez de
    rellenarlo. Respeta la doctrina y la ley chilena.

Responde SOLO con el JSON, dentro de un bloque de código. Sin explicaciones antes ni después.

--- MATERIAL ---
${trozo.texto}
--- FIN DEL MATERIAL ---`
}

/** Saca las vallas de código y cualquier texto alrededor del JSON. */
export function limpiarRespuesta(bruto: string): string {
  let texto = bruto.trim()
  const enValla = texto.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (enValla) texto = enValla[1].trim()
  const inicioObjeto = texto.indexOf('{')
  const inicioLista = texto.indexOf('[')
  const inicio =
    inicioObjeto === -1 ? inicioLista
      : inicioLista === -1 ? inicioObjeto
        : Math.min(inicioObjeto, inicioLista)
  if (inicio > 0) texto = texto.slice(inicio)
  const finObjeto = texto.lastIndexOf('}')
  const finLista = texto.lastIndexOf(']')
  const fin = Math.max(finObjeto, finLista)
  if (fin !== -1 && fin < texto.length - 1) texto = texto.slice(0, fin + 1)
  return texto.trim()
}

export async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    try {
      const area = document.createElement('textarea')
      area.value = texto
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      const listo = document.execCommand('copy')
      document.body.removeChild(area)
      return listo
    } catch {
      return false
    }
  }
}

// ---------------------------------------------------------------------------
// Corrección de desarrollos con Claude (el modo "con internet").
// Sin internet, la app corrige sola buscando en el texto los términos de la
// pauta; esto es la corrección semántica, que además comenta.
// ---------------------------------------------------------------------------

export interface OpcionesCorreccion {
  enunciado: string
  puntos: string[]
  respuesta: string
  ref?: string
}

export function armarPedidoCorreccion(o: OpcionesCorreccion): string {
  const pauta = o.puntos.map((p, i) => `${i}. ${p}`).join('\n')
  const comillas = '"'.repeat(3)
  return `Eres mi profesor de Derecho en Chile y estás corrigiendo una pregunta de desarrollo.
Corrige con criterio de examen universitario: exigente pero justo. No me regales puntos, y tampoco
me castigues por decir lo mismo con otras palabras.

PREGUNTA:
${o.enunciado}
${o.ref ? `\nReferencia de la materia: ${o.ref}` : ''}

PAUTA (cada punto va con su número):
${pauta}

MI RESPUESTA:
${comillas}
${o.respuesta}
${comillas}

Devuelve SOLO este JSON, dentro de un bloque de código:

{
  "correccion": 1,
  "puntos": [
    { "indice": 0, "logrado": true, "comentario": "una línea: qué dije bien o qué faltó" }
  ],
  "nota": "laTenia | aMedias | meFalto",
  "loQueFalto": "lo más importante que no dije, en dos líneas",
  "comentario": "un consejo concreto para la próxima vez, en dos líneas"
}

Reglas: un punto es "logrado" solo si la idea está de verdad en mi respuesta, aunque esté dicha con
otras palabras; no si apenas la insinué. "nota" es "laTenia" si logré casi todo, "aMedias" si logré
la mitad o si dije algo derechamente equivocado, y "meFalto" si no llegué. Si escribí algo que en
Derecho está mal, dilo en "comentario" aunque la pauta no lo pregunte.`
}

export interface Correccion {
  puntos: { indice: number; logrado: boolean; comentario?: string }[]
  nota?: 'laTenia' | 'aMedias' | 'meFalto'
  loQueFalto?: string
  comentario?: string
}

export function leerCorreccion(bruto: string, cuantosPuntos: number): Correccion {
  const limpio = limpiarRespuesta(bruto)
  if (!limpio) throw new Error('Pega la respuesta de Claude.')
  let dato: unknown
  try {
    dato = JSON.parse(limpio)
  } catch {
    throw new Error('Eso no es JSON válido. Copia el bloque de código completo, con sus llaves.')
  }
  if (typeof dato !== 'object' || dato === null) {
    throw new Error('La corrección no tiene el formato esperado.')
  }
  const o = dato as Record<string, unknown>
  if (!Array.isArray(o.puntos)) throw new Error('A la corrección le falta la lista "puntos".')

  const puntos = o.puntos
    .map((p) => {
      if (typeof p !== 'object' || p === null) return null
      const q = p as Record<string, unknown>
      const indice = Number(q.indice)
      if (!Number.isInteger(indice) || indice < 0 || indice >= cuantosPuntos) return null
      return {
        indice,
        logrado: q.logrado === true,
        comentario: typeof q.comentario === 'string' ? q.comentario : undefined,
      }
    })
    .filter((p) => p !== null) as Correccion['puntos']

  if (puntos.length === 0) throw new Error('La corrección no trae ningún punto reconocible.')

  const nota =
    o.nota === 'laTenia' || o.nota === 'aMedias' || o.nota === 'meFalto' ? o.nota : undefined

  return {
    puntos,
    nota,
    loQueFalto: typeof o.loQueFalto === 'string' ? o.loQueFalto : undefined,
    comentario: typeof o.comentario === 'string' ? o.comentario : undefined,
  }
}
