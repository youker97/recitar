import { useEffect, useState } from 'react'
import { db, nuevoId } from '../datos/db'
import { borrarItem, guardarItem } from '../datos/repos'
import { useCursoActivo, useItems } from '../datos/hooks'
import { ir, useUbicacion } from '../rutas'
import {
  NOMBRE_TIPO, NOMBRE_VERBO, TIPOS_ITEM,
  type DatosAlternativas, type DatosArticulo, type DatosConcepto, type DatosDesarrollo, type DatosLista,
  type DatosRepregunta,
  type DatosTextoLegal, type DatosTriaje, type DatosVF, type FuenteDefinicion, type Item, type TipoItem,
  type Verbo,
} from '../datos/tipos'
import { validarPaquete } from '../datos/esquema'
import { puntosDe } from '../logica/corrector'

function separarClaves(texto: string): string[] | undefined {
  const claves = texto.split(',').map((c) => c.trim()).filter(Boolean)
  return claves.length > 0 ? claves : undefined
}

interface Borrador {
  tipo: TipoItem
  bloque: string
  seccion: string
  ref: string
  // campos de todos los tipos, se usan los que correspondan
  pregunta: string
  esVerdadera: boolean
  justificacion: string
  respuesta: string
  titulo: string
  articulo: string
  elementos: string
  numero: string
  materia: string
  cuerpo: string
  textoLiteral: string
  enunciado: string
  verbo: Verbo
  checklist: string
  minutosSugeridos: string
  opciones: string
  correcta: number
  explicacion: string
  claves: string
  termino: string
  definicion: string
  contexto: string
  fuenteDefinicion: FuenteDefinicion
}

const VACIO: Borrador = {
  tipo: 'vf', bloque: '', seccion: '', ref: '',
  pregunta: '', esVerdadera: true, justificacion: '', respuesta: '',
  titulo: '', articulo: '', elementos: '', numero: '', materia: '', cuerpo: '',
  textoLiteral: '', enunciado: '', verbo: 'definir', checklist: '', minutosSugeridos: '',
  opciones: '', correcta: 0, explicacion: '', claves: '',
  termino: '', definicion: '', contexto: '', fuenteDefinicion: 'propia',
}

function aBorrador(item: Item): Borrador {
  const b = { ...VACIO, tipo: item.tipo, bloque: item.bloque, seccion: item.seccion ?? '', ref: item.ref }
  const d = item.datos as unknown as Record<string, unknown>
  switch (item.tipo) {
    case 'vf': {
      const v = d as unknown as DatosVF
      return {
        ...b, pregunta: v.pregunta, esVerdadera: v.esVerdadera,
        justificacion: v.justificacion, claves: (v.claves ?? []).join(', '),
      }
    }
    case 'alternativas': {
      const v = d as unknown as DatosAlternativas
      return {
        ...b, pregunta: v.pregunta, opciones: v.opciones.join('\n'),
        correcta: v.correcta, explicacion: v.explicacion,
      }
    }
    case 'lista': {
      const v = d as unknown as DatosLista
      return { ...b, titulo: v.titulo, articulo: v.articulo ?? '', elementos: v.elementos.join('\n') }
    }
    case 'articulo': {
      const v = d as unknown as DatosArticulo
      return { ...b, numero: v.numero, materia: v.materia, cuerpo: v.cuerpo ?? '' }
    }
    case 'textoLegal': {
      const v = d as unknown as DatosTextoLegal
      return { ...b, numero: v.numero, textoLiteral: v.textoLiteral }
    }
    case 'triaje': {
      const v = d as unknown as DatosTriaje
      return { ...b, enunciado: v.enunciado, verbo: v.verbo }
    }
    case 'desarrollo': {
      const v = d as unknown as DatosDesarrollo
      return {
        ...b,
        enunciado: v.enunciado,
        checklist: puntosDe(v.checklist)
          .map((p) => (p.claves?.length ? `${p.texto} | ${p.claves.join(', ')}` : p.texto))
          .join('\n'),
        minutosSugeridos: v.minutosSugeridos ? String(v.minutosSugeridos) : '',
      }
    }
    case 'repregunta': {
      const v = d as unknown as DatosRepregunta
      return { ...b, pregunta: v.pregunta, respuesta: v.respuesta }
    }
    case 'concepto': {
      const v = d as unknown as DatosConcepto
      return {
        ...b, termino: v.termino, definicion: v.definicion,
        contexto: v.contexto ?? '', fuenteDefinicion: v.fuente ?? 'propia',
      }
    }
    default: return b
  }
}

function aBruto(b: Borrador): Record<string, unknown> {
  const base = {
    tipo: b.tipo,
    bloque: b.bloque.trim(),
    seccion: b.seccion.trim() || undefined,
    ref: b.ref.trim(),
  }
  switch (b.tipo) {
    case 'vf':
      return {
        ...base, pregunta: b.pregunta, esVerdadera: b.esVerdadera, justificacion: b.justificacion,
        claves: separarClaves(b.claves),
      }
    case 'alternativas':
      return {
        ...base, pregunta: b.pregunta, explicacion: b.explicacion, correcta: b.correcta,
        opciones: b.opciones.split('\n').map((l) => l.trim()).filter(Boolean),
      }
    case 'lista':
      return {
        ...base, titulo: b.titulo, articulo: b.articulo || undefined,
        elementos: b.elementos.split('\n').map((l) => l.trim()).filter(Boolean),
      }
    case 'articulo':
      return { ...base, numero: b.numero, materia: b.materia, cuerpo: b.cuerpo || undefined }
    case 'textoLegal':
      return { ...base, numero: b.numero, textoLiteral: b.textoLiteral }
    case 'triaje':
      return { ...base, enunciado: b.enunciado, verbo: b.verbo }
    case 'desarrollo':
      return {
        ...base, enunciado: b.enunciado,
        // Cada línea: "punto de la pauta | término, otro término"
        checklist: b.checklist
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean)
          .map((l) => {
            const [texto, claves] = l.split('|')
            return { texto: texto.trim(), claves: separarClaves(claves ?? '') }
          }),
        minutosSugeridos: b.minutosSugeridos ? Number(b.minutosSugeridos) : undefined,
      }
    case 'repregunta':
      return { ...base, pregunta: b.pregunta, respuesta: b.respuesta }
    case 'concepto':
      return {
        ...base, termino: b.termino, definicion: b.definicion,
        contexto: b.contexto || undefined, fuente: b.fuenteDefinicion,
      }
    default:
      return base
  }
}

export function Editor() {
  const { params } = useUbicacion()
  const id = params.get('id') ?? undefined
  const padreDe = params.get('padre') ?? undefined
  const curso = useCursoActivo()
  const items = useItems(curso?.id)
  const [borrador, setBorrador] = useState<Borrador>(VACIO)
  const [original, setOriginal] = useState<Item | null>(null)
  const [errores, setErrores] = useState<string[]>([])
  const [guardado, setGuardado] = useState(false)

  const bloquesUsados = [...new Set(items.map((i) => i.bloque).filter(Boolean))].sort()
  const seccionesUsadas = [...new Set(items.map((i) => i.seccion).filter(Boolean))].sort() as string[]
  const hijos = id ? items.filter((i) => i.padreId === id).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)) : []

  useEffect(() => {
    let vivo = true
    if (!id) {
      setOriginal(null)
      setBorrador((b) => ({
        ...VACIO,
        tipo: padreDe ? 'repregunta' : b.tipo,
        bloque: b.bloque,
      }))
      return
    }
    db.items.get(id).then((item) => {
      if (!vivo || !item) return
      setOriginal(item)
      setBorrador(aBorrador(item))
    })
    return () => { vivo = false }
  }, [id, padreDe])

  function cambiar<K extends keyof Borrador>(campo: K, valor: Borrador[K]) {
    setBorrador((b) => ({ ...b, [campo]: valor }))
    setGuardado(false)
  }

  async function guardar() {
    if (!curso) return
    const bruto = aBruto(borrador)
    const validado = validarPaquete({ items: [bruto] })
    if (!validado.ok) {
      setErrores(validado.errores.map((e) => e.mensaje))
      return
    }
    setErrores([])
    const ahora = Date.now()
    const datos = validado.items[0].datos
    const item: Item = original
      ? {
          ...original,
          bloque: borrador.bloque.trim(),
          seccion: borrador.seccion.trim() || undefined,
          tipo: borrador.tipo,
          ref: borrador.ref.trim(),
          datos,
          actualizadoEn: ahora,
        }
      : {
          id: nuevoId(),
          cursoId: curso.id,
          bloque: borrador.bloque.trim(),
          seccion: borrador.seccion.trim() || undefined,
          tipo: borrador.tipo,
          datos,
          ref: borrador.ref.trim(),
          padreId: padreDe,
          orden: padreDe ? hijos.length : undefined,
          origen: 'manual',
          creadoEn: ahora,
          actualizadoEn: ahora,
        }
    await guardarItem(item)
    setGuardado(true)
    if (!original) ir(`/editor?id=${item.id}`)
  }

  if (!curso) {
    return <div className="vacio"><p>Crea un curso primero.</p><a className="boton" href="#/material">Ir al material</a></div>
  }

  const t = borrador.tipo

  return (
    <div>
      <div className="titulo-seccion">
        <h1>{id ? 'Editar ítem' : padreDe ? 'Nueva repregunta' : 'Ítem nuevo'}</h1>
        <a className="lado" href="#/material">volver al material</a>
      </div>

      {errores.length > 0 && (
        <div className="aviso-error">
          <strong>Falta algo:</strong>
          <ul style={{ margin: '0.3rem 0 0 1rem', padding: 0 }}>
            {errores.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      <label className="campo">
        <span>Tipo</span>
        <select value={t} onChange={(e) => cambiar('tipo', e.target.value as TipoItem)}>
          {TIPOS_ITEM.map((x) => <option key={x} value={x}>{NOMBRE_TIPO[x]}</option>)}
        </select>
      </label>

      <div className="grilla-dos">
        <label className="campo">
          <span>Bloque (la materia)</span>
          <input
            type="text"
            list="bloques-usados"
            value={borrador.bloque}
            placeholder="Ej: Obligaciones"
            onChange={(e) => cambiar('bloque', e.target.value)}
          />
          <datalist id="bloques-usados">
            {bloquesUsados.map((b) => <option key={b} value={b} />)}
          </datalist>
        </label>
        <label className="campo">
          <span>Sección (subtema del apunte)</span>
          <input
            type="text"
            list="secciones-usadas"
            value={borrador.seccion}
            placeholder="Ej: Causales de justificación"
            onChange={(e) => cambiar('seccion', e.target.value)}
          />
          <datalist id="secciones-usadas">
            {seccionesUsadas.map((x) => <option key={x} value={x} />)}
          </datalist>
        </label>
        <label className="campo">
          <span>Referencia</span>
          <input
            type="text"
            value={borrador.ref}
            placeholder="Ej: art. 1489 CC / apunte cl. 7"
            onChange={(e) => cambiar('ref', e.target.value)}
          />
        </label>
      </div>

      {t === 'vf' && (
        <>
          <label className="campo">
            <span>Afirmación</span>
            <textarea className="serif" rows={3} value={borrador.pregunta} onChange={(e) => cambiar('pregunta', e.target.value)} />
          </label>
          <div className="opciones opciones-fila seccion">
            <button type="button" className="opcion" aria-pressed={borrador.esVerdadera} onClick={() => cambiar('esVerdadera', true)}>Es verdadera</button>
            <button type="button" className="opcion" aria-pressed={!borrador.esVerdadera} onClick={() => cambiar('esVerdadera', false)}>Es falsa</button>
          </div>
          <label className="campo">
            <span>Justificación correcta</span>
            <textarea className="serif" rows={4} value={borrador.justificacion} onChange={(e) => cambiar('justificacion', e.target.value)} />
          </label>
          <label className="campo">
            <span>Términos que debe traer tu justificación (separados por comas)</span>
            <input
              type="text"
              value={borrador.claves}
              placeholder="condición resolutoria tácita, 1489, indemnización"
              onChange={(e) => cambiar('claves', e.target.value)}
            />
            <span className="apunte">
              Con esto la app corrige sola, sin internet. Si lo dejas vacío, los deduce de la
              justificación.
            </span>
          </label>
        </>
      )}

      {t === 'alternativas' && (
        <>
          <label className="campo">
            <span>Pregunta</span>
            <textarea className="serif" rows={3} value={borrador.pregunta} onChange={(e) => cambiar('pregunta', e.target.value)} />
          </label>
          <label className="campo">
            <span>Opciones, una por línea</span>
            <textarea className="serif" rows={5} value={borrador.opciones} onChange={(e) => cambiar('opciones', e.target.value)} />
          </label>
          <label className="campo">
            <span>¿Cuál es la correcta?</span>
            <select value={borrador.correcta} onChange={(e) => cambiar('correcta', Number(e.target.value))}>
              {borrador.opciones.split('\n').map((l) => l.trim()).filter(Boolean).map((o, i) => (
                <option key={i} value={i}>{String.fromCharCode(97 + i)}) {o.slice(0, 60)}</option>
              ))}
            </select>
          </label>
          <label className="campo">
            <span>Explicación</span>
            <textarea className="serif" rows={3} value={borrador.explicacion} onChange={(e) => cambiar('explicacion', e.target.value)} />
          </label>
        </>
      )}

      {t === 'lista' && (
        <>
          <label className="campo">
            <span>Qué se enumera</span>
            <textarea className="serif" rows={2} value={borrador.titulo} onChange={(e) => cambiar('titulo', e.target.value)} />
          </label>
          <label className="campo">
            <span>Artículo (opcional)</span>
            <input type="text" value={borrador.articulo} placeholder="Art. 1445" onChange={(e) => cambiar('articulo', e.target.value)} />
          </label>
          <label className="campo">
            <span>Elementos, uno por línea</span>
            <textarea className="serif" rows={7} value={borrador.elementos} onChange={(e) => cambiar('elementos', e.target.value)} />
          </label>
        </>
      )}

      {t === 'articulo' && (
        <div className="grilla-dos">
          <label className="campo">
            <span>Número</span>
            <input type="text" value={borrador.numero} placeholder="1489" onChange={(e) => cambiar('numero', e.target.value)} />
          </label>
          <label className="campo">
            <span>Cuerpo legal (opcional)</span>
            <input type="text" value={borrador.cuerpo} placeholder="Código Civil" onChange={(e) => cambiar('cuerpo', e.target.value)} />
          </label>
          <label className="campo" style={{ gridColumn: '1 / -1' }}>
            <span>De qué trata</span>
            <textarea className="serif" rows={3} value={borrador.materia} onChange={(e) => cambiar('materia', e.target.value)} />
          </label>
        </div>
      )}

      {t === 'textoLegal' && (
        <>
          <label className="campo">
            <span>Número del artículo</span>
            <input type="text" value={borrador.numero} onChange={(e) => cambiar('numero', e.target.value)} />
          </label>
          <label className="campo">
            <span>Texto literal</span>
            <textarea className="serif" rows={6} value={borrador.textoLiteral} onChange={(e) => cambiar('textoLiteral', e.target.value)} />
            <span className="apunte">
              Los huecos se eligen solos y cambian entre repasos. Si quieres forzar uno, escribe la
              palabra entre llaves dobles: {'{{resolución}}'}.
            </span>
          </label>
        </>
      )}

      {t === 'triaje' && (
        <>
          <label className="campo">
            <span>Enunciado como lo pondría el profesor</span>
            <textarea className="serif" rows={3} value={borrador.enunciado} onChange={(e) => cambiar('enunciado', e.target.value)} />
          </label>
          <label className="campo">
            <span>Qué pide</span>
            <select value={borrador.verbo} onChange={(e) => cambiar('verbo', e.target.value as Verbo)}>
              {(Object.keys(NOMBRE_VERBO) as Verbo[]).map((v) => (
                <option key={v} value={v}>{NOMBRE_VERBO[v]}</option>
              ))}
            </select>
          </label>
        </>
      )}

      {t === 'desarrollo' && (
        <>
          <label className="campo">
            <span>Enunciado</span>
            <textarea className="serif" rows={3} value={borrador.enunciado} onChange={(e) => cambiar('enunciado', e.target.value)} />
          </label>
          <label className="campo">
            <span>Pauta, un punto por línea</span>
            <textarea className="serif" rows={7} value={borrador.checklist} onChange={(e) => cambiar('checklist', e.target.value)} />
            <span className="apunte">
              Para que la app corrija sola, agrega después de una barra los términos que tienen que
              aparecer: <code>Distingue culpa grave de leve | culpa grave, culpa leve, 44</code>
            </span>
          </label>
          <label className="campo">
            <span>Minutos sugeridos (opcional)</span>
            <input type="number" min={1} value={borrador.minutosSugeridos} onChange={(e) => cambiar('minutosSugeridos', e.target.value)} />
          </label>
        </>
      )}

      {t === 'concepto' && (
        <>
          <label className="campo">
            <span>El término</span>
            <input
              type="text"
              value={borrador.termino}
              placeholder="enajenación"
              onChange={(e) => cambiar('termino', e.target.value)}
            />
          </label>
          <label className="campo">
            <span>Qué significa, en este ramo</span>
            <textarea className="serif" rows={4} value={borrador.definicion} onChange={(e) => cambiar('definicion', e.target.value)} />
          </label>
          <label className="campo">
            <span>La frase del apunte donde aparece (opcional)</span>
            <textarea className="serif" rows={3} value={borrador.contexto} onChange={(e) => cambiar('contexto', e.target.value)} />
            <span className="apunte">
              Con esto la app te la pregunta también dentro de la frase, con la palabra tapada.
            </span>
          </label>
          <label className="campo">
            <span>De dónde salió la definición</span>
            <select value={borrador.fuenteDefinicion} onChange={(e) => cambiar('fuenteDefinicion', e.target.value as FuenteDefinicion)}>
              <option value="apunte">Del apunte</option>
              <option value="claude">De Claude</option>
              <option value="propia">Mía</option>
            </select>
          </label>
        </>
      )}

      {t === 'repregunta' && (
        <>
          <label className="campo">
            <span>Repregunta</span>
            <textarea className="serif" rows={2} value={borrador.pregunta} onChange={(e) => cambiar('pregunta', e.target.value)} />
          </label>
          <label className="campo">
            <span>Respuesta</span>
            <textarea className="serif" rows={4} value={borrador.respuesta} onChange={(e) => cambiar('respuesta', e.target.value)} />
          </label>
        </>
      )}

      <div className="pie-fijo">
        <button type="button" className="boton boton-fuerte boton-ancho" onClick={guardar}>
          {guardado ? 'Guardado ✓' : 'Guardar'}
        </button>
      </div>

      {id && (
        <>
          <hr className="filete" />
          <section className="seccion">
            <div className="titulo-seccion">
              <h2>Repreguntas encadenadas</h2>
              <span className="lado numeral">{hijos.length}</span>
            </div>
            <p className="apunte">
              Salen una tras otra después de este ítem, sin avisar cuántas son. Es donde se cae el oral.
            </p>
            <ul className="lista-limpia">
              {hijos.map((h) => (
                <li key={h.id} className="renglon">
                  <div className="crece">
                    <div className="estudio" style={{ fontSize: '1rem' }}>
                      {(h.datos as DatosRepregunta).pregunta}
                    </div>
                    <div className="ref">{h.ref}</div>
                  </div>
                  <div className="botonera">
                    <button type="button" className="boton boton-chico" onClick={() => ir(`/editor?id=${h.id}`)}>Editar</button>
                    <button
                      type="button"
                      className="boton boton-chico boton-peligro"
                      onClick={() => { if (window.confirm('¿Borrar esta repregunta?')) borrarItem(h.id) }}
                    >
                      Borrar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <button type="button" className="boton" onClick={() => ir(`/editor?padre=${id}`)}>
              Agregar repregunta
            </button>
          </section>
        </>
      )}

      {original && (
        <>
          <hr className="filete" />
          <button
            type="button"
            className="boton boton-peligro"
            onClick={() => {
              if (window.confirm('¿Borrar este ítem y sus repreguntas?')) {
                borrarItem(original.id).then(() => ir('/material'))
              }
            }}
          >
            Borrar el ítem
          </button>
        </>
      )}
    </div>
  )
}
