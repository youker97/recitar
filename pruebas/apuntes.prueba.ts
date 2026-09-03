import { describe, expect, it } from 'vitest'
import { convertirApunte } from '../src/importar/texto'
import { limpiarRespuesta, partirTexto } from '../src/importar/claude'

const APUNTE = `## Obligaciones
[art. 1489 CC]

F: La condición resolutoria tácita opera de pleno derecho.
J: Requiere sentencia judicial.
? ¿Y la ordinaria?
= Esa sí opera de pleno derecho. [art. 1479 CC]

LISTA: Requisitos del acto jurídico [art. 1445]
- capaz
- consentimiento sin vicios
- objeto lícito
- causa lícita

ALT: ¿Qué exige la resolución?
- Opera de pleno derecho
+ Sentencia judicial
- Una carta del acreedor

ART 1698: carga de la prueba
TRIAJE(posturas): Refiérase a la culpa en abstracto o en concreto.

DES: Explique la responsabilidad extracontractual
- daño
- culpa
- causalidad

Esto es un párrafo suelto que no tiene marca.`

describe('conversión de apuntes .md y .txt', () => {
  const r = convertirApunte(APUNTE)

  it('reconoce cada tipo de ítem', () => {
    expect(r.items.map((i) => i.tipo)).toEqual(['vf', 'lista', 'alternativas', 'articulo', 'triaje', 'desarrollo'])
  })

  it('reconoce la alternativa marcada con +', () => {
    const alt = r.items.find((i) => i.tipo === 'alternativas')!
    const d = alt.datos as { opciones: string[]; correcta: number }
    expect(d.opciones).toHaveLength(3)
    expect(d.opciones[d.correcta]).toBe('Sentencia judicial')
  })

  it('cuelga la repregunta del ítem anterior', () => {
    expect(r.items[0].hijos).toHaveLength(1)
    expect(r.items[0].hijos[0].ref).toBe('art. 1479 CC')
  })

  it('usa el encabezado como bloque y la referencia suelta como ref', () => {
    expect(r.items[0].bloque).toBe('Obligaciones')
    expect(r.items.find((i) => i.tipo === 'lista')!.ref).toBe('art. 1445')
  })

  it('no se traga las líneas que no entiende: las deja aparte', () => {
    expect(r.restos.some((x) => x.includes('párrafo suelto'))).toBe(true)
  })
})

describe('puente con Claude', () => {
  it('parte los apuntes largos por párrafos', () => {
    const largo = Array.from({ length: 40 }, (_, i) => `Párrafo ${i} `.repeat(30)).join('\n\n')
    const trozos = partirTexto(largo, 2000)
    expect(trozos.length).toBeGreaterThan(1)
    expect(trozos.every((t) => t.texto.length <= 2400)).toBe(true)
    expect(trozos[0].total).toBe(trozos.length)
  })

  it('rescata el JSON aunque venga con explicaciones y vallas de código', () => {
    const bruto = 'Claro, acá va:\n\n```json\n{"recitar":1,"items":[]}\n```\n\n¿Te sirve?'
    expect(JSON.parse(limpiarRespuesta(bruto))).toEqual({ recitar: 1, items: [] })
  })

  it('rescata el JSON aunque venga sin vallas', () => {
    const bruto = 'Acá tienes: {"recitar":1,"items":[]} listo.'
    expect(JSON.parse(limpiarRespuesta(bruto))).toEqual({ recitar: 1, items: [] })
  })
})
