import { useMemo, useState } from 'react'
import { nuevoId } from '../datos/db'
import { guardarItems } from '../datos/repos'
import { useCursoActivo, useFuentes, useItems } from '../datos/hooks'
import type { DatosConcepto, Fuente, Item, SeccionApunte } from '../datos/tipos'
import { mapaDe } from './Pasada'
import { presentar, textoDeSeccion } from '../logica/mapa'
import { normalizar } from '../logica/comparar'
import { armarPedidoVocabulario, copiar, limpiarRespuesta, partirTexto } from '../importar/claude'
import { validarPaquete } from '../datos/esquema'
import { ir, useUbicacion } from '../rutas'

/** Un tema de apunte normal entra completo; solo se parte si es enorme. */
const LARGO_VOCABULARIO = 18000

type Paso = 'elegir' | 'traer' | 'triaje'
type Marca = 'se' | 'masOMenos' | 'no'

/**
 * Vocabulario del tema: sacarse de encima las palabras que no conoces antes de
 * leer. Leer un texto con diez términos desconocidos no es estudiar, es
 * decodificar ruido.
 *
 * Los términos y sus definiciones los trae Claude de una vez. La app no
 * intenta adivinar cuáles son: contando palabras repetidas salían "como
 * sucede" y "esta teoría", y la frase del apunte que contiene un "se entiende
 * por" casi nunca es la definición del término que uno buscaba.
 */
export function Vocabulario() {
  const { params } = useUbicacion()
  const curso = useCursoActivo()
  const fuentes = useFuentes(curso?.id)
  const items = useItems(curso?.id)

  const [fuenteId, setFuenteId] = useState<string | null>(params.get('fuente'))
  const [indice, setIndice] = useState<number>(Number(params.get('tema') ?? -1))
  const [paso, setPaso] = useState<Paso>(params.get('tema') ? 'traer' : 'elegir')
  const [parte, setParte] = useState(0)
  const [pegado, setPegado] = useState('')
  const [traidos, setTraidos] = useState<DatosConcepto[]>([])
  const [marcas, setMarcas] = useState<Record<string, Marca>>({})
  const [aviso, setAviso] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fuente = fuentes.find((f) => f.id === fuenteId) ?? null
  const secciones = fuente ? mapaDe(fuente) : []
  const seccion: SeccionApunte | null = fuente && indice >= 0 ? secciones[indice] ?? null : null
  const texto = fuente && seccion ? textoDeSeccion(fuente.texto, seccion) : ''
  // Un tema entero cabe en un pedido: partirlo obliga a copiar dos veces y
  // encima Claude pierde de vista los pares contrapuestos del tema.
  const trozos = useMemo(() => (texto ? partirTexto(texto, LARGO_VOCABULARIO) : []), [texto])

  // Los que ya están guardados no se vuelven a preguntar.
  const yaGuardados = useMemo(
    () => new Set(items.filter((i) => i.tipo === 'concepto')
      .map((i) => normalizar((i.datos as DatosConcepto).termino))),
    [items],
  )

  const marcados = Object.keys(marcas).length
  const porEstudiar = traidos.filter((c) => marcas[c.termino] !== 'se')

  function empezar(f: string, i: number) {
    setFuenteId(f)
    setIndice(i)
    setParte(0)
    setPegado('')
    setTraidos([])
    setMarcas({})
    setError(null)
    setAviso(null)
    setPaso('traer')
  }

  function leerRespuestaDeClaude() {
    if (!fuente || !seccion) return
    setError(null)
    const limpio = limpiarRespuesta(pegado)
    if (!limpio) { setError('Pega la respuesta de Claude.'); return }
    let bruto: unknown
    try {
      bruto = JSON.parse(limpio)
    } catch {
      setError('Eso no es JSON válido. Copia el bloque de código completo.')
      return
    }
    // El bloque y el tema los pone la app: son del apunte, no de la respuesta.
    const paquete = bruto as { items?: unknown } | null
    const conOrigen = paquete && Array.isArray(paquete.items)
      ? {
          ...paquete,
          items: paquete.items.map((i) =>
            i && typeof i === 'object'
              ? { ...(i as object), bloque: fuente.bloque, seccion: seccion.titulo }
              : i),
        }
      : bruto
    const validado = validarPaquete(conOrigen)
    const conceptos = validado.items
      .filter((i) => i.tipo === 'concepto')
      .map((i) => i.datos as DatosConcepto)
    if (conceptos.length === 0) {
      setError(validado.errores[0]
        ? `${validado.errores[0].donde}: ${validado.errores[0].mensaje}`
        : 'No vino ningún término.')
      return
    }

    // Sin repetir lo que ya tienes de antes, ni dentro de la misma respuesta.
    const vistos = new Set(yaGuardados)
    const nuevos: DatosConcepto[] = []
    for (const c of conceptos) {
      const clave = normalizar(c.termino)
      if (!clave || vistos.has(clave)) continue
      vistos.add(clave)
      nuevos.push(c)
    }
    if (nuevos.length === 0) {
      setError('Todos esos términos ya los tenías guardados.')
      return
    }
    setTraidos(nuevos)
    setMarcas({})
    setPegado('')
    setAviso(conceptos.length > nuevos.length
      ? `${nuevos.length} términos nuevos (${conceptos.length - nuevos.length} ya los tenías).`
      : null)
    setPaso('triaje')
  }

  async function guardar() {
    if (!curso || !fuente || !seccion) return
    const ahora = Date.now()
    const nuevos: Item[] = traidos.map((c, orden) => ({
      id: nuevoId(),
      cursoId: curso.id,
      bloque: fuente.bloque,
      seccion: seccion.titulo,
      tipo: 'concepto' as const,
      datos: c,
      ref: `${fuente.titulo} · ${presentar(seccion.titulo)}`,
      orden,
      origen: 'manual' as const,
      creadoEn: ahora,
      actualizadoEn: ahora,
    }))
    await guardarItems(nuevos)

    // Se estudian ahora las que no sabías. Las que dijiste saber quedan
    // guardadas y entran solas a las sesiones: ahí se verá si era cierto.
    const ahoraMismo = nuevos.filter((n) => marcas[(n.datos as DatosConcepto).termino] !== 'se')
    if (ahoraMismo.length === 0) {
      ir('/mapa')
      return
    }
    ir(`/estudiar?items=${ahoraMismo.map((n) => n.id).join(',')}`)
  }

  if (!curso || fuentes.length === 0) {
    return (
      <div className="vacio">
        <p>Primero importa un apunte.</p>
        <a className="boton boton-fuerte" href="#/importar">Importar</a>
      </div>
    )
  }

  // ---------- elegir tema ----------
  if (paso === 'elegir' || !fuente || !seccion) {
    return (
      <div>
        <div className="titulo-seccion"><h1>Vocabulario</h1></div>
        <p className="apunte">
          Antes de leer un tema, sácate de encima las palabras que no conoces. Claude saca los
          términos del tema y qué significa cada uno; tú marcas cuáles ya sabías y la app te
          pregunta el resto. Leer con diez términos desconocidos no es estudiar.
        </p>
        {fuentes.map((f) => <TemasDeUnApunte key={f.id} fuente={f} onElegir={empezar} />)}
      </div>
    )
  }

  // ---------- traer el vocabulario ----------
  if (paso === 'traer') {
    return (
      <div>
        <div className="titulo-seccion">
          <h2>{presentar(seccion.titulo)}</h2>
          <button type="button" className="boton boton-chico" onClick={() => setPaso('elegir')}>
            Otro tema
          </button>
        </div>

        {error && <div className="aviso-error">{error}</div>}

        <p className="apunte">
          Copia el pedido, pégalo en Claude y trae su respuesta. Va el texto de este tema y vuelve
          con los términos y sus definiciones: una copiada y una pegada, no una por palabra.
        </p>

        {trozos.length > 1 && (
          <label className="campo">
            <span>Este tema es largo: va en {trozos.length} partes</span>
            <select value={parte} onChange={(e) => setParte(Number(e.target.value))}>
              {trozos.map((t, i) => <option key={i} value={i}>Parte {t.numero} de {t.total}</option>)}
            </select>
          </label>
        )}

        <div className="botonera">
          <button
            type="button"
            className="boton boton-guia"
            onClick={async () => {
              const listo = await copiar(armarPedidoVocabulario({
                curso: ramoDe(curso.nombre, fuente.bloque),
                tema: presentar(seccion.titulo),
                trozo: trozos[parte] ?? { numero: 1, total: 1, texto },
              }))
              setAviso(listo ? 'Pedido copiado. Pégalo en Claude.' : 'No se pudo copiar solo.')
            }}
          >
            Copiar el pedido para Claude
          </button>
        </div>

        {aviso && <p className="apunte" style={{ marginTop: '0.5rem' }}>{aviso}</p>}

        <label className="campo" style={{ marginTop: '1rem' }}>
          <span>Pega acá la respuesta</span>
          <textarea rows={5} value={pegado} onChange={(e) => setPegado(e.target.value)} />
        </label>

        <div className="pie-fijo">
          <button
            type="button"
            className="boton boton-fuerte boton-ancho"
            disabled={!pegado.trim()}
            onClick={leerRespuestaDeClaude}
          >
            Traer el vocabulario
          </button>
        </div>
      </div>
    )
  }

  // ---------- triaje: cuáles ya sabías ----------
  return (
    <div>
      <div className="titulo-seccion">
        <h2>{presentar(seccion.titulo)}</h2>
        <span className="lado numeral">{marcados} de {traidos.length}</span>
      </div>

      {aviso && <div className="hoja hoja-bien">{aviso}</div>}
      {error && <div className="aviso-error">{error}</div>}

      <p className="apunte">
        Un toque por término, sin pensarlo mucho: para las palabras uno sabe bastante bien si las
        conoce o no. Las definiciones no se muestran acá a propósito —si las lees primero, vas a
        creer que las sabías todas.
      </p>

      <ul className="lista-limpia">
        {traidos.map((c) => (
          <li key={c.termino} className="renglon renglon-acciones">
            <div className="crece estudio" style={{ fontSize: '1.05rem' }}>{c.termino}</div>
            <div className="botonera">
              {([['se', 'La sé'], ['masOMenos', 'Más o menos'], ['no', 'No la sé']] as const).map(
                ([valor, rotulo]) => (
                  <button
                    key={valor}
                    type="button"
                    className="boton boton-chico"
                    aria-pressed={marcas[c.termino] === valor}
                    onClick={() => setMarcas({ ...marcas, [c.termino]: valor })}
                  >
                    {rotulo}
                  </button>
                ),
              )}
            </div>
          </li>
        ))}
      </ul>

      <div className="pie-fijo">
        <button
          type="button"
          className="boton boton-fuerte boton-ancho"
          disabled={marcados < traidos.length}
          onClick={guardar}
        >
          {marcados < traidos.length
            ? `Te faltan ${traidos.length - marcados}`
            : porEstudiar.length > 0
              ? `Guardar ${traidos.length} y estudiar ${porEstudiar.length}`
              : `Guardar ${traidos.length}`}
        </button>
        {marcados === traidos.length && porEstudiar.length === 0 && (
          <p className="apunte centrado" style={{ marginTop: '0.4rem' }}>
            Las sabías todas. Quedan guardadas y van a aparecer en las sesiones igual.
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * Cómo nombrar el ramo en el pedido. Importa de verdad: "enajenación" no
 * significa lo mismo en Civil que en Penal, y el nombre del curso suele ser
 * genérico mientras que el bloque trae la materia.
 */
function ramoDe(curso: string, bloque: string): string {
  const b = bloque.trim()
  if (!b || normalizar(b) === normalizar(curso)) return curso
  return `${curso} (${b})`
}

/** Los temas de un apunte, hasta donde llegó el curso. */
function TemasDeUnApunte({
  fuente,
  onElegir,
}: {
  fuente: Fuente
  onElegir: (fuenteId: string, indice: number) => void
}) {
  const secciones = mapaDe(fuente)
  const tope = Number.isInteger(fuente.hasta) ? fuente.hasta : secciones.length - 1
  return (
    <section className="seccion">
      <div className="titulo-seccion">
        <h2 style={{ fontSize: '1.02rem' }}>{fuente.titulo}</h2>
      </div>
      <div className="opciones">
        {secciones.slice(0, tope + 1).map((s, i) => (
          <button key={i} type="button" className="opcion" onClick={() => onElegir(fuente.id, i)}>
            {presentar(s.titulo)}
          </button>
        ))}
      </div>
    </section>
  )
}
