import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useAjustes, useCursoActivo } from '../datos/hooks'
import { cargarDatos, registrarRespuesta } from '../datos/repos'
import type { Confianza, DatosAlternativas, DatosArticulo, DatosLista, DatosTextoLegal, DatosTriaje, DatosVF, Item, ModoEstudio, Verbo } from '../datos/tipos'
import { NOMBRE_VERBO } from '../datos/tipos'
import { intercalar } from '../logica/cola'
import { generarAlternativas, puedeGenerarse } from '../logica/generador'
import { evaluarRespuesta, seCorrigeSola, type RespuestaEnsayo, type ResultadoEnsayo } from '../logica/evaluar'
import { prepararHuecos } from '../logica/huecos'
import { resumenDeItem } from '../logica/resumen'
import { useCronometro } from '../componentes/Cronometro'
import { ElegirConfianza } from '../componentes/Confianza'
import { ir } from '../rutas'

type Paso = 'armar' | 'rindiendo' | 'informe'

interface Contestada {
  item: Item
  original: Item
  respuesta: RespuestaEnsayo
  resultado: ResultadoEnsayo
}

const VERBOS: Verbo[] = ['definir', 'posturas', 'importancia', 'distinciones']

const MODO_POR_TIPO: Partial<Record<Item['tipo'], ModoEstudio>> = {
  vf: 'vf',
  alternativas: 'alternativas',
  lista: 'lista',
  articulo: 'articuloMateriaNumero',
  textoLegal: 'textoLegal',
  triaje: 'triaje',
}

export function Ensayo() {
  const curso = useCursoActivo()
  const ajustes = useAjustes()
  const datos = useLiveQuery(() => cargarDatos(curso?.id), [curso?.id])

  const [paso, setPaso] = useState<Paso>('armar')
  const [bloquesElegidos, setBloquesElegidos] = useState<string[]>([])
  const [cantidad, setCantidad] = useState(15)
  const [conAlternativas, setConAlternativas] = useState(true)
  const [preguntas, setPreguntas] = useState<{ item: Item; original: Item }[]>([])
  const [indice, setIndice] = useState(0)
  const [contestadas, setContestadas] = useState<Contestada[]>([])
  const [respuesta, setRespuesta] = useState<RespuestaEnsayo>({ confianza: 'masOMenos' })
  const [pidiendoConfianza, setPidiendoConfianza] = useState(false)
  const reloj = useCronometro(false)

  const bloques = useMemo(
    () => [...new Set((datos ?? []).map((d) => d.item.bloque).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')),
    [datos],
  )

  function armar() {
    if (!datos) return
    const candidatos = datos.filter(
      ({ item }) =>
        !item.suspendido &&
        seCorrigeSola(item) &&
        (bloquesElegidos.length === 0 || bloquesElegidos.includes(item.bloque)),
    )
    const pool = datos.map((d) => d.item)
    const mezclados = intercalar(
      [...candidatos].sort(() => Math.random() - 0.5),
      (x) => x.item.bloque,
      (x) => x.item.tipo,
    ).slice(0, cantidad)

    const armadas = mezclados.map(({ item, progreso }) => {
      if (conAlternativas && puedeGenerarse(item) && Math.random() < 0.5) {
        const generada = generarAlternativas(item, pool, progreso.totalRepasos)
        if (generada) return { item: generada, original: item }
      }
      return { item, original: item }
    })

    if (armadas.length === 0) return
    setPreguntas(armadas)
    setIndice(0)
    setContestadas([])
    setRespuesta({ confianza: 'masOMenos' })
    setPidiendoConfianza(false)
    setPaso('rindiendo')
    reloj.reiniciar()
    reloj.arrancar()
  }

  async function siguiente(confianza: Confianza) {
    const actual = preguntas[indice]
    const conConfianza = { ...respuesta, confianza }
    const resultado = evaluarRespuesta(actual.item, conConfianza)

    await registrarRespuesta({
      item: actual.original,
      modo: MODO_POR_TIPO[actual.item.tipo] ?? 'vf',
      confianza,
      nota: resultado.nota,
      duracionMs: 0,
      respuesta: resultado.dado,
      aciertos: resultado.aciertos,
      total: resultado.total,
    })

    setContestadas((prev) => [...prev, { item: actual.item, original: actual.original, respuesta: conConfianza, resultado }])
    setRespuesta({ confianza: 'masOMenos' })
    setPidiendoConfianza(false)

    if (indice + 1 >= preguntas.length) {
      reloj.detener()
      setPaso('informe')
    } else {
      setIndice(indice + 1)
    }
  }

  if (!curso) {
    return <div className="vacio"><p>Primero crea un curso y mete material.</p><a className="boton" href="#/importar">Importar</a></div>
  }

  // ---------- armar ----------
  if (paso === 'armar') {
    return (
      <div>
        <div className="titulo-seccion"><h1>Ensayo</h1></div>
        <p className="apunte">
          Una evaluación entera, sin ver ninguna respuesta hasta el final. La app la corrige sola:
          no necesita internet. Lo que falles se va derecho al registro de errores.
        </p>

        <label className="campo">
          <span>Cuántas preguntas</span>
          <select value={cantidad} onChange={(e) => setCantidad(Number(e.target.value))}>
            {[10, 15, 20, 30, 40].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>

        <fieldset style={{ border: 0, padding: 0, margin: '0 0 1rem' }}>
          <legend className="apunte" style={{ padding: 0 }}>
            Bloques (si no marcas ninguno, entran todos)
          </legend>
          <div className="opciones">
            {bloques.map((b) => (
              <label key={b} className="marca-check" style={{ padding: '0.35rem 0' }}>
                <input
                  type="checkbox"
                  checked={bloquesElegidos.includes(b)}
                  onChange={(e) =>
                    setBloquesElegidos((prev) => (e.target.checked ? [...prev, b] : prev.filter((x) => x !== b)))
                  }
                />
                {b}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="marca-check" style={{ padding: '0.4rem 0' }}>
          <input type="checkbox" checked={conAlternativas} onChange={(e) => setConAlternativas(e.target.checked)} />
          <span>
            <strong>Armar preguntas de alternativas</strong>
            <br />
            <span className="apunte">
              La app inventa alternativas con tu propio material: los distractores salen de otros
              ítems del mismo bloque.
            </span>
          </span>
        </label>

        <div className="pie-fijo">
          <button type="button" className="boton boton-fuerte boton-ancho" onClick={armar}>
            Empezar el ensayo
          </button>
        </div>
      </div>
    )
  }

  // ---------- rindiendo ----------
  if (paso === 'rindiendo') {
    const { item } = preguntas[indice]
    const listo = respuestaLista(item, respuesta)

    return (
      <div>
        <div className="barra-progreso" aria-hidden="true">
          <div style={{ width: `${(indice / preguntas.length) * 100}%` }} />
        </div>
        <div className="titulo-seccion">
          <h2 className="numeral">Pregunta {indice + 1} de {preguntas.length}</h2>
          <span className="lado numeral">{Math.floor(reloj.ms / 60000)} min</span>
        </div>

        {pidiendoConfianza ? (
          <ElegirConfianza onElegir={siguiente} />
        ) : (
          <>
            <PreguntaEnsayo item={item} respuesta={respuesta} onCambiar={setRespuesta} bloques={bloques} />
            <div className="pie-fijo">
              <button
                type="button"
                className="boton boton-fuerte boton-ancho"
                disabled={!listo}
                onClick={() => setPidiendoConfianza(true)}
              >
                {indice + 1 === preguntas.length ? 'Terminar' : 'Siguiente'}
              </button>
              {!listo && <p className="apunte centrado" style={{ marginTop: '0.4rem' }}>Contesta algo. En la prueba tampoco puedes dejarla en blanco.</p>}
            </div>
          </>
        )}
      </div>
    )
  }

  // ---------- informe ----------
  const buenas = contestadas.filter((c) => c.resultado.correcto).length
  const graves = contestadas.filter((c) => c.resultado.grave).length
  const nota = contestadas.length > 0 ? Math.round((buenas / contestadas.length) * 100) : 0
  const porBloque = new Map<string, { buenas: number; total: number }>()
  for (const c of contestadas) {
    const x = porBloque.get(c.original.bloque) ?? { buenas: 0, total: 0 }
    x.total++
    if (c.resultado.correcto) x.buenas++
    porBloque.set(c.original.bloque, x)
  }

  return (
    <div>
      <div className="titulo-seccion">
        <h1>Resultado del ensayo</h1>
        <span className="lado numeral">{Math.round(reloj.ms / 60000)} min</span>
      </div>

      <div className="marcador">
        <div className="marcador-cifra numeral">{nota}%</div>
        <div className="apunte">{buenas} de {contestadas.length} correctas</div>
      </div>

      {graves > 0 && (
        <div className="hoja hoja-alerta">
          <strong>{graves} las diste por sabidas y estaban malas.</strong>
          <p style={{ margin: '0.3rem 0 0' }}>Quedaron arriba en el registro de errores.</p>
        </div>
      )}

      <section className="seccion">
        <h2>Por bloque</h2>
        {[...porBloque.entries()].map(([bloque, x]) => (
          <div key={bloque} className="renglon">
            <span className="crece">{bloque}</span>
            <Barra porcentaje={Math.round((x.buenas / x.total) * 100)} />
            <span className="numeral">{x.buenas}/{x.total}</span>
          </div>
        ))}
      </section>

      <section className="seccion">
        <h2>Pregunta por pregunta</h2>
        <ul className="lista-limpia">
          {contestadas.map((c, i) => (
            <li key={i} className="renglon">
              <div className="crece">
                <div className="estudio" style={{ fontSize: '1rem' }}>
                  {resumenDeItem(c.item)}
                </div>
                {c.resultado.correcto ? (
                  <div className="apunte verde">Bien</div>
                ) : (
                  <>
                    <div className="apunte rojo">Tú: {recortar(c.resultado.dado)}</div>
                    <div className="apunte verde">Era: {recortar(c.resultado.esperado)}</div>
                  </>
                )}
                <div className="ref">{c.original.ref || c.original.bloque}</div>
              </div>
              {c.resultado.grave && <span className="etiqueta etiqueta-grave">grave</span>}
            </li>
          ))}
        </ul>
      </section>

      <div className="botonera-columna seccion">
        <button type="button" className="boton boton-fuerte" onClick={() => setPaso('armar')}>Otro ensayo</button>
        <button type="button" className="boton" onClick={() => ir('/errores')}>Ver mis errores</button>
      </div>
      <p className="apunte">Meta diaria: {ajustes.metaDiaria} respuestas.</p>
    </div>
  )
}

function recortar(texto: string, largo = 120): string {
  const limpio = texto.trim()
  return limpio.length > largo ? `${limpio.slice(0, largo)}…` : limpio || '—'
}

export function Barra({ porcentaje }: { porcentaje: number }) {
  return (
    <span className="barra" aria-hidden="true">
      <span style={{ width: `${Math.max(2, Math.min(100, porcentaje))}%` }} />
    </span>
  )
}

function respuestaLista(item: Item, r: RespuestaEnsayo): boolean {
  switch (item.tipo) {
    case 'vf': return r.esVerdadera !== undefined
    case 'alternativas': return r.opcion !== undefined
    case 'triaje': return !!r.bloque && !!r.verbo
    case 'textoLegal': return (r.huecos ?? []).filter((h) => h.trim()).length > 0
    default: return !!r.texto?.trim()
  }
}

function PreguntaEnsayo({
  item,
  respuesta,
  onCambiar,
  bloques,
}: {
  item: Item
  respuesta: RespuestaEnsayo
  onCambiar: (r: RespuestaEnsayo) => void
  bloques: string[]
}) {
  if (item.tipo === 'vf') {
    const d = item.datos as DatosVF
    return (
      <>
        <p className="estudio-grande">{d.pregunta}</p>
        <div className="opciones opciones-fila seccion">
          <button type="button" className="opcion" aria-pressed={respuesta.esVerdadera === true}
            onClick={() => onCambiar({ ...respuesta, esVerdadera: true })}><strong>Verdadero</strong></button>
          <button type="button" className="opcion" aria-pressed={respuesta.esVerdadera === false}
            onClick={() => onCambiar({ ...respuesta, esVerdadera: false })}><strong>Falso</strong></button>
        </div>
      </>
    )
  }

  if (item.tipo === 'alternativas') {
    const d = item.datos as DatosAlternativas
    return (
      <>
        <p className="estudio-grande">{d.pregunta}</p>
        <div className="opciones seccion">
          {d.opciones.map((o, i) => (
            <button key={i} type="button" className="opcion" aria-pressed={respuesta.opcion === i}
              onClick={() => onCambiar({ ...respuesta, opcion: i })}>
              <span><strong>{String.fromCharCode(97 + i)})</strong> {o}</span>
            </button>
          ))}
        </div>
      </>
    )
  }

  if (item.tipo === 'lista') {
    const d = item.datos as DatosLista
    return (
      <>
        <p className="estudio-grande">{d.articulo ? `${d.articulo}: ` : ''}{d.titulo}</p>
        <p className="apunte">Son {d.elementos.length}. Uno por línea.</p>
        <textarea className="serif" rows={Math.max(4, d.elementos.length)} value={respuesta.texto ?? ''}
          onChange={(e) => onCambiar({ ...respuesta, texto: e.target.value })} />
      </>
    )
  }

  if (item.tipo === 'articulo') {
    const d = item.datos as DatosArticulo
    return (
      <>
        <p className="estudio-grande">{d.materia}</p>
        <p className="apunte">¿Qué artículo es{d.cuerpo ? ` del ${d.cuerpo}` : ''}?</p>
        <input type="text" value={respuesta.texto ?? ''} inputMode="numeric"
          onChange={(e) => onCambiar({ ...respuesta, texto: e.target.value })} />
      </>
    )
  }

  if (item.tipo === 'textoLegal') {
    const d = item.datos as DatosTextoLegal
    const preparado = prepararHuecos(d.textoLiteral, 0)
    const posiciones = new Map<number, number>()
    preparado.huecos.forEach((indice, k) => posiciones.set(indice, k))
    const valores = respuesta.huecos ?? preparado.huecos.map(() => '')
    return (
      <>
        <p className="apunte">Artículo {d.numero} — completa.</p>
        <p className="estudio" style={{ lineHeight: 2.2 }}>
          {preparado.trozos.map((trozo, i) => {
            if (!trozo.esPalabra) return <span key={i}>{trozo.texto}</span>
            const k = posiciones.get(trozo.indicePalabra!)
            if (k === undefined) return <span key={i}>{trozo.texto}</span>
            return (
              <input key={i} className="hueco" type="text" value={valores[k] ?? ''}
                aria-label={`Hueco ${k + 1}`}
                onChange={(e) => {
                  const copia = [...valores]
                  copia[k] = e.target.value
                  onCambiar({ ...respuesta, huecos: copia })
                }} />
            )
          })}
        </p>
      </>
    )
  }

  if (item.tipo === 'triaje') {
    const d = item.datos as DatosTriaje
    return (
      <>
        <p className="estudio-grande">{d.enunciado}</p>
        <h3>¿De qué bloque es?</h3>
        <div className="opciones">
          {(bloques.includes(d.bloque) ? bloques : [...bloques, d.bloque]).map((b) => (
            <button key={b} type="button" className="opcion" aria-pressed={respuesta.bloque === b}
              onClick={() => onCambiar({ ...respuesta, bloque: b })}>{b}</button>
          ))}
        </div>
        <h3 style={{ marginTop: '1rem' }}>¿Qué te pide?</h3>
        <div className="opciones">
          {VERBOS.map((v) => (
            <button key={v} type="button" className="opcion" aria-pressed={respuesta.verbo === v}
              onClick={() => onCambiar({ ...respuesta, verbo: v })}>{NOMBRE_VERBO[v]}</button>
          ))}
        </div>
      </>
    )
  }

  return <p className="estudio-grande">{resumenDeItem(item)}</p>
}
