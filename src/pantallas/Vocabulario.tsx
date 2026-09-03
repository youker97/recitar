import { useMemo, useState } from 'react'
import { nuevoId } from '../datos/db'
import { guardarItems } from '../datos/repos'
import { useCursoActivo, useFuentes, useItems } from '../datos/hooks'
import type { DatosConcepto, Item, SeccionApunte } from '../datos/tipos'
import { mapaDe } from './Pasada'
import { presentar, textoDeSeccion } from '../logica/mapa'
import { conceptosDeTexto } from '../logica/conceptos'
import { aparicionesDe, buscarDefinicion } from '../logica/definiciones'
import { normalizar } from '../logica/comparar'
import { contarPalabras } from '../logica/corrector'
import { armarPedidoVocabulario, copiar, limpiarRespuesta } from '../importar/claude'
import { validarPaquete } from '../datos/esquema'
import { ir, useUbicacion } from '../rutas'

type Paso = 'elegir' | 'triaje' | 'verificar' | 'definir'
type Marca = 'se' | 'masOMenos' | 'no'

interface Definicion {
  definicion: string
  contexto?: string
  fuente: 'apunte' | 'claude' | 'propia'
}

const TOPE_TERMINOS = 24
const CUANTAS_VERIFICAR = 3

/**
 * Vocabulario del tema: sacarse de encima las palabras que no conoces antes de
 * leer. Leer un texto con diez términos desconocidos no es estudiar, es
 * decodificar ruido.
 */
export function Vocabulario() {
  const { params } = useUbicacion()
  const curso = useCursoActivo()
  const fuentes = useFuentes(curso?.id)
  const items = useItems(curso?.id)

  const [fuenteId, setFuenteId] = useState<string | null>(params.get('fuente'))
  const [indice, setIndice] = useState<number>(Number(params.get('tema') ?? -1))
  const [paso, setPaso] = useState<Paso>(params.get('tema') ? 'triaje' : 'elegir')
  const [marcas, setMarcas] = useState<Record<string, Marca>>({})
  const [respuestas, setRespuestas] = useState<Record<string, string>>({})
  const [definiciones, setDefiniciones] = useState<Record<string, Definicion>>({})
  const [pegado, setPegado] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fuente = fuentes.find((f) => f.id === fuenteId) ?? null
  const secciones = fuente ? mapaDe(fuente) : []
  const seccion: SeccionApunte | null = fuente && indice >= 0 ? secciones[indice] ?? null : null
  const texto = fuente && seccion ? textoDeSeccion(fuente.texto, seccion) : ''

  // Los que ya están guardados no se vuelven a preguntar.
  const yaGuardados = useMemo(
    () => new Set(items.filter((i) => i.tipo === 'concepto')
      .map((i) => normalizar((i.datos as DatosConcepto).termino))),
    [items],
  )

  const terminos = useMemo(() => {
    if (!texto) return []
    return conceptosDeTexto(texto)
      .map((c) => c.termino)
      .filter((t) => !yaGuardados.has(normalizar(t)))
      .slice(0, TOPE_TERMINOS)
  }, [texto, yaGuardados])

  const marcados = Object.keys(marcas).length
  const sabidos = terminos.filter((t) => marcas[t] === 'se')
  const desconocidos = terminos.filter((t) => marcas[t] === 'no' || marcas[t] === 'masOMenos')
  const aVerificar = sabidos.slice(0, CUANTAS_VERIFICAR)

  /** Todo lo que hay que definir: lo que no sabía más lo que creyó saber y falló. */
  const porDefinir = useMemo(() => {
    const fallados = aVerificar.filter((t) => respuestas[t] === '__falle__')
    return [...new Set([...desconocidos, ...fallados])]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marcas, respuestas, terminos])

  function empezar(f: string, i: number) {
    setFuenteId(f)
    setIndice(i)
    setMarcas({})
    setRespuestas({})
    setDefiniciones({})
    setPaso('triaje')
  }

  function irADefinir() {
    // Lo que el propio apunte define ya queda resuelto, sin internet.
    const encontradas: Record<string, Definicion> = {}
    for (const termino of porDefinir) {
      const hallazgo = buscarDefinicion(texto, termino)
      if (hallazgo.definicion) {
        encontradas[termino] = {
          definicion: hallazgo.definicion,
          contexto: hallazgo.contexto ?? undefined,
          fuente: 'apunte',
        }
      }
    }
    setDefiniciones(encontradas)
    setPaso('definir')
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
    // El bloque y el tema los pone la app, no Claude: son del apunte, no de la
    // respuesta, y si los pidiéramos en el pedido se equivocaría al escribirlos.
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
    if (validado.items.length === 0) {
      setError(validado.errores[0]
        ? `${validado.errores[0].donde}: ${validado.errores[0].mensaje}`
        : 'No vino ningún concepto.')
      return
    }
    const nuevas = { ...definiciones }
    let cuantas = 0
    for (const entrante of validado.items) {
      if (entrante.tipo !== 'concepto') continue
      const d = entrante.datos as DatosConcepto
      const calce = porDefinir.find((t) => normalizar(t) === normalizar(d.termino)) ?? d.termino
      nuevas[calce] = {
        definicion: d.definicion,
        contexto: d.contexto ?? buscarDefinicion(texto, calce).contexto ?? undefined,
        fuente: d.fuente === 'apunte' ? 'apunte' : 'claude',
      }
      cuantas++
    }
    setDefiniciones(nuevas)
    setPegado('')
    setAviso(`${cuantas} definiciones traídas.`)
  }

  async function guardar() {
    if (!curso || !fuente || !seccion) return
    const ahora = Date.now()
    const nuevos: Item[] = Object.entries(definiciones)
      .filter(([, d]) => d.definicion.trim().length > 0)
      .map(([termino, d], orden) => ({
        id: nuevoId(),
        cursoId: curso.id,
        bloque: fuente.bloque,
        seccion: seccion.titulo,
        tipo: 'concepto' as const,
        datos: {
          termino,
          definicion: d.definicion.trim(),
          contexto: d.contexto,
          fuente: d.fuente,
        },
        ref: `${fuente.titulo} · ${seccion.titulo}`,
        orden,
        origen: 'manual' as const,
        creadoEn: ahora,
        actualizadoEn: ahora,
      }))

    if (nuevos.length === 0) { setError('No hay ninguna definición que guardar.'); return }
    await guardarItems(nuevos)
    ir(`/estudiar?items=${nuevos.map((n) => n.id).join(',')}`)
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
          Antes de leer un tema, sácate de encima las palabras que no conoces. Marcas cuáles no
          sabes, la app te da la definición —del apunte si está, y si no se la pedimos a Claude— y
          después te las pregunta. Leer con diez términos desconocidos no es estudiar.
        </p>
        {fuentes.map((f) => (
          <section key={f.id} className="seccion">
            <div className="titulo-seccion">
              <h2 style={{ fontSize: '1.02rem' }}>{f.titulo}</h2>
            </div>
            <div className="opciones">
              {mapaDe(f).slice(0, (f.hasta ?? mapaDe(f).length - 1) + 1).map((s, i) => (
                <button key={i} type="button" className="opcion" onClick={() => empezar(f.id, i)}>
                  {presentar(s.titulo)}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    )
  }

  // ---------- triaje ----------
  if (paso === 'triaje') {
    return (
      <div>
        <div className="titulo-seccion">
          <h2>{presentar(seccion.titulo)}</h2>
          <span className="lado numeral">{marcados} de {terminos.length}</span>
        </div>
        {terminos.length === 0 ? (
          <div className="vacio">
            <p>No quedan términos nuevos en este tema.</p>
            <button type="button" className="boton" onClick={() => setPaso('elegir')}>Elegir otro</button>
          </div>
        ) : (
          <>
            <p className="apunte">
              Un toque por término. Sin pensarlo mucho: para las palabras uno sabe bastante bien si
              las conoce o no.
            </p>
            <ul className="lista-limpia">
              {terminos.map((t) => (
                <li key={t} className="renglon renglon-acciones">
                  <div className="crece estudio" style={{ fontSize: '1.05rem' }}>{t}</div>
                  <div className="botonera">
                    {([['se', 'La sé'], ['masOMenos', 'Más o menos'], ['no', 'No la sé']] as const).map(
                      ([valor, texto]) => (
                        <button
                          key={valor}
                          type="button"
                          className="boton boton-chico"
                          aria-pressed={marcas[t] === valor}
                          onClick={() => setMarcas({ ...marcas, [t]: valor })}
                        >
                          {texto}
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
                disabled={marcados < terminos.length}
                onClick={() => (aVerificar.length > 0 ? setPaso('verificar') : irADefinir())}
              >
                Seguir
              </button>
              {marcados < terminos.length && (
                <p className="apunte centrado" style={{ marginTop: '0.4rem' }}>
                  Te faltan {terminos.length - marcados}.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    )
  }

  // ---------- verificar las que dijo saber ----------
  if (paso === 'verificar') {
    const listo = aVerificar.every((t) => (respuestas[t] ?? '').length > 0)
    return (
      <div>
        <div className="titulo-seccion"><h2>Las que dijiste saber</h2></div>
        <p className="apunte">
          Escríbelas en una línea. Es donde más se falla: creer que se sabe una palabra y no poder
          decirla.
        </p>
        {aVerificar.map((t) => {
          const hallazgo = buscarDefinicion(texto, t)
          const escrita = respuestas[t] ?? ''
          const mostrada = escrita.length > 0 && escrita !== '__falle__'
          return (
            <section key={t} className="hoja">
              <h3>{t}</h3>
              {!mostrada && escrita !== '__falle__' ? (
                <>
                  <textarea
                    className="serif"
                    rows={2}
                    value={respuestas[`borrador-${t}`] ?? ''}
                    onChange={(e) => setRespuestas({ ...respuestas, [`borrador-${t}`]: e.target.value })}
                  />
                  <button
                    type="button"
                    className="boton boton-chico"
                    disabled={contarPalabras(respuestas[`borrador-${t}`] ?? '') < 3}
                    onClick={() => setRespuestas({ ...respuestas, [t]: respuestas[`borrador-${t}`] ?? '' })}
                  >
                    Comparar
                  </button>
                </>
              ) : (
                <>
                  {escrita !== '__falle__' && (
                    <p className="apunte">Escribiste: {escrita}</p>
                  )}
                  {hallazgo.contexto ? (
                    <p className="estudio">En el apunte: «{hallazgo.contexto}»</p>
                  ) : (
                    <p className="apunte">El apunte no la explica. Compara con lo que sepas.</p>
                  )}
                  <div className="botonera">
                    <button
                      type="button"
                      className="boton boton-chico"
                      aria-pressed={escrita !== '__falle__'}
                      onClick={() => setRespuestas({ ...respuestas, [t]: respuestas[`borrador-${t}`] ?? 'la sabía' })}
                    >
                      La tenía
                    </button>
                    <button
                      type="button"
                      className="boton boton-chico boton-peligro"
                      aria-pressed={escrita === '__falle__'}
                      onClick={() => setRespuestas({ ...respuestas, [t]: '__falle__' })}
                    >
                      No la tenía
                    </button>
                  </div>
                </>
              )}
            </section>
          )
        })}
        <div className="pie-fijo">
          <button type="button" className="boton boton-fuerte boton-ancho" disabled={!listo} onClick={irADefinir}>
            Seguir a las definiciones
          </button>
        </div>
      </div>
    )
  }

  // ---------- definir ----------
  const sinDefinir = porDefinir.filter((t) => !definiciones[t])
  const conDefinicion = porDefinir.filter((t) => definiciones[t])

  return (
    <div>
      <div className="titulo-seccion">
        <h2>Definiciones</h2>
        <span className="lado numeral">{conDefinicion.length} de {porDefinir.length}</span>
      </div>

      {aviso && <div className="hoja hoja-bien">{aviso}</div>}
      {error && <div className="aviso-error">{error}</div>}

      {porDefinir.length === 0 ? (
        <div className="vacio">
          <p>Sabías todas. No hay nada que guardar.</p>
          <button type="button" className="boton" onClick={() => setPaso('elegir')}>Otro tema</button>
        </div>
      ) : (
        <>
          {conDefinicion.length > 0 && (
            <section className="seccion">
              <h3>Listas</h3>
              {conDefinicion.map((t) => (
                <div key={t} className="hoja">
                  <strong>{t}</strong>
                  <span className="etiqueta" style={{ marginLeft: '0.4rem' }}>
                    {definiciones[t].fuente === 'apunte' ? 'del apunte' : 'de Claude'}
                  </span>
                  <textarea
                    className="serif"
                    rows={3}
                    style={{ marginTop: '0.4rem' }}
                    value={definiciones[t].definicion}
                    onChange={(e) =>
                      setDefiniciones({
                        ...definiciones,
                        [t]: { ...definiciones[t], definicion: e.target.value, fuente: 'propia' },
                      })
                    }
                  />
                </div>
              ))}
            </section>
          )}

          {sinDefinir.length > 0 && (
            <section className="seccion">
              <div className="titulo-seccion">
                <h3>Estas no las define el apunte</h3>
                <span className="lado numeral">{sinDefinir.length}</span>
              </div>
              <p className="apunte">
                Copia el pedido, pégalo en Claude y trae su respuesta. Va una sola vez con todas.
              </p>
              <ul className="apunte" style={{ paddingLeft: '1.1rem' }}>
                {sinDefinir.map((t) => <li key={t}>{t}</li>)}
              </ul>
              <div className="botonera">
                <button
                  type="button"
                  className="boton boton-fuerte"
                  onClick={async () => {
                    const listo = await copiar(armarPedidoVocabulario({
                      curso: curso.nombre,
                      tema: seccion.titulo,
                      terminos: sinDefinir.map((t) => ({ termino: t, apariciones: aparicionesDe(texto, t) })),
                    }))
                    setAviso(listo ? 'Pedido copiado. Pégalo en Claude.' : 'No se pudo copiar solo.')
                  }}
                >
                  Copiar el pedido para Claude
                </button>
              </div>
              <label className="campo" style={{ marginTop: '0.8rem' }}>
                <span>Pega acá la respuesta</span>
                <textarea rows={4} value={pegado} onChange={(e) => setPegado(e.target.value)} />
              </label>
              <button type="button" className="boton" disabled={!pegado.trim()} onClick={leerRespuestaDeClaude}>
                Traer las definiciones
              </button>
            </section>
          )}

          <div className="pie-fijo">
            <button
              type="button"
              className="boton boton-fuerte boton-ancho"
              disabled={conDefinicion.length === 0}
              onClick={guardar}
            >
              Guardar {conDefinicion.length} y estudiarlas
            </button>
          </div>
        </>
      )}
    </div>
  )
}
