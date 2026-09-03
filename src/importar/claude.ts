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

Cada ítem es un objeto con "tipo", "bloque", "ref" y los campos de su tipo:

- {"tipo":"vf","bloque":"","ref":"","pregunta":"","esVerdadera":true|false,"justificacion":""}
- {"tipo":"lista","bloque":"","ref":"","titulo":"","articulo":"(opcional)","elementos":["","",""]}
- {"tipo":"articulo","bloque":"","ref":"","numero":"1489","materia":"de qué trata","cuerpo":"Código Civil"}
- {"tipo":"textoLegal","bloque":"","ref":"","numero":"1545","textoLiteral":"el texto exacto, sin resumir"}
- {"tipo":"triaje","bloque":"","ref":"","enunciado":"","verbo":"definir|posturas|importancia|distinciones"}
- {"tipo":"desarrollo","bloque":"","ref":"","enunciado":"","checklist":["punto 1","punto 2"],"minutosSugeridos":10}
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
8. ${orientacionOral
    ? 'La prueba es ORAL: cada ítem importante lleva de 2 a 4 repreguntas en "hijos", encadenadas, cada una más honda que la anterior, como el profesor que sigue raspando después de la primera respuesta. Incluye al menos una repregunta que ataque la excepción o el caso límite.'
    : 'Los ítems importantes llevan 1 a 3 repreguntas en "hijos", encadenadas, cada una más honda que la anterior.'}
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
