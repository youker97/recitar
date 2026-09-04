import { useMemo, useState } from 'react'
import { db, nuevoId } from '../datos/db'
import { guardarItems } from '../datos/repos'
import { useCursoActivo, useFuentes, useItems } from '../datos/hooks'
import type { Fuente, SeccionApunte } from '../datos/tipos'
import { mapaDe } from './Pasada'
import { detectarSecciones, fusionarSecciones, mapaDesdeClaude, presentar, textoDeSeccion } from '../logica/mapa'
import { normalizar } from '../logica/comparar'
import { aItems, validarPaquete } from '../datos/esquema'
import { armarPedido, armarPedidoMapa, copiar, limpiarRespuesta, partirTexto } from '../importar/claude'
import { ir } from '../rutas'

/**
 * El mapa: qué trae cada apunte, hasta dónde llegó el curso, qué temas ya
 * tienen su primera pasada, y desde dónde se le piden a Claude las preguntas
 * de un tema. Un apunte de 300 hojas se trabaja así: de a un tema.
 */
export function Mapa() {
  const curso = useCursoActivo()
  const fuentes = useFuentes(curso?.id)
  const items = useItems(curso?.id)
  const [abierto, setAbierto] = useState<string | null>(null)
  const [pidiendo, setPidiendo] = useState<{ fuente: Fuente; indice: number } | null>(null)
  // Se guarda el id, no el apunte: el panel lo va guardando a medida que
  // trabaja, y con una copia vieja la segunda parte no vería a la primera.
  const [armandoId, setArmandoId] = useState<string | null>(null)
  const armando = fuentes.find((f) => f.id === armandoId) ?? null

  // Las palabras del vocabulario se cuentan aparte: no son preguntas del tema,
  // son el paso previo a poder leerlo.
  const porSeccion = useMemo(() => {
    const mapa = new Map<string, { preguntas: number; palabras: number }>()
    for (const i of items) {
      if (!i.seccion) continue
      const clave = normalizar(i.seccion)
      const cuenta = mapa.get(clave) ?? { preguntas: 0, palabras: 0 }
      if (i.tipo === 'concepto') cuenta.palabras++
      else cuenta.preguntas++
      mapa.set(clave, cuenta)
    }
    return mapa
  }, [items])

  async function marcarHasta(fuente: Fuente, indice: number) {
    await db.fuentes.put({ ...fuente, secciones: mapaDe(fuente), hasta: indice })
  }

  async function rehacerTemas(fuente: Fuente) {
    const secciones = detectarSecciones(fuente.texto)
    await db.fuentes.put({
      ...fuente,
      secciones,
      temasDeClaude: false,
      hasta: secciones.length - 1,
      avance: 0,
      terminada: false,
    })
  }

  async function borrarApunte(fuente: Fuente) {
    const cuantos = items.filter(
      (i) => i.seccion && (fuente.secciones ?? []).some((s) => normalizar(s.titulo) === normalizar(i.seccion!)),
    ).length
    const aviso = cuantos > 0
      ? `¿Borrar “${fuente.titulo}”? Las ${cuantos} preguntas que salieron de él NO se borran: quedan en Material.`
      : `¿Borrar “${fuente.titulo}”?`
    if (!window.confirm(aviso)) return
    await db.fuentes.delete(fuente.id)
  }

  async function alternarCubierta(fuente: Fuente, indice: number) {
    const secciones = mapaDe(fuente).map((s, i) => (i === indice ? { ...s, cubierta: !s.cubierta } : s))
    await db.fuentes.put({ ...fuente, secciones, terminada: secciones.every((s) => s.cubierta) })
  }

  if (!curso) {
    return (
      <div className="vacio">
        <p>Todavía no hay material.</p>
        <a className="boton boton-fuerte" href="#/importar">Importar apuntes</a>
      </div>
    )
  }

  return (
    <div>
      <div className="titulo-seccion">
        <h1>Mis apuntes</h1>
        <span className="lado numeral">{fuentes.length} apuntes</span>
      </div>

      <div className="botonera" style={{ marginBottom: '0.9rem' }}>
        <a className="boton boton-fuerte" href="#/importar">Meter apuntes</a>
        <a className="boton" href="#/material">Ver las preguntas</a>
      </div>

      <p className="apunte">
        Cada apunte trae sus temas. Marca hasta dónde llegó el curso: lo que viene después existe en
        el archivo pero todavía no es tuyo, así que no aparece en las sesiones.
      </p>

      {fuentes.length === 0 ? (
        <div className="vacio">
          <p>Este curso no tiene apuntes.</p>
          <a className="boton" href="#/importar">Importar apuntes</a>
        </div>
      ) : (
        fuentes.map((fuente) => {
          const secciones = mapaDe(fuente)
          const tope = Number.isInteger(fuente.hasta) ? fuente.hasta : secciones.length - 1
          const desplegado = abierto === fuente.id || (fuentes.length === 1 && abierto !== '')
          return (
            <section key={fuente.id} className="seccion">
              <div className="titulo-seccion">
                <h2 style={{ fontSize: '1.05rem' }}>{fuente.titulo}</h2>
                <button
                  type="button"
                  className="boton boton-chico"
                  onClick={() => setAbierto(desplegado ? '' : fuente.id)}
                >
                  {desplegado ? 'Ocultar' : 'Ver temas'}
                </button>
              </div>
              <p className="apunte">
                {fuente.bloque} · {secciones.length} temas ·{' '}
                {secciones.filter((s) => s.cubierta).length} con la pasada hecha ·{' '}
                {Math.round(fuente.texto.length / 1000)} mil caracteres
              </p>
              {!fuente.temasDeClaude && (
                <p className="apunte">
                  Estos temas los cortó la app buscando títulos en el archivo: reconoce el formato,
                  no entiende de qué trata. Claude puede leerlo y partirlo de verdad.
                </p>
              )}
              <div className="botonera" style={{ marginBottom: '0.5rem' }}>
                <button
                  type="button"
                  className={`boton boton-chico${fuente.temasDeClaude ? '' : ' boton-guia'}`}
                  onClick={() => setArmandoId(fuente.id)}
                >
                  {fuente.temasDeClaude ? 'Rehacer los temas con Claude' : 'Que Claude arme los temas'}
                </button>
                <button type="button" className="boton boton-chico" onClick={() => rehacerTemas(fuente)}>
                  Rehacer los temas
                </button>
                <button type="button" className="boton boton-chico boton-peligro" onClick={() => borrarApunte(fuente)}>
                  Borrar este apunte
                </button>
              </div>

              {desplegado && (
                <ul className="lista-limpia">
                  {secciones.map((s, i) => {
                    const dentro = i <= tope
                    const cuenta = porSeccion.get(normalizar(s.titulo)) ?? { preguntas: 0, palabras: 0 }
                    const cuantos = cuenta.preguntas
                    return (
                      <li key={i} className="renglon renglon-acciones">
                        <div className="crece">
                          <div className={dentro ? 'estudio' : 'estudio tenue'} style={{ fontSize: '1.02rem' }}>
                            {presentar(s.titulo)}
                          </div>
                          <div className="apunte">
                            {!dentro
                              ? 'Todavía no entra'
                              : s.cubierta ? 'Pasada hecha' : 'Falta la primera pasada'}
                            {cuantos > 0 ? ` · ${cuantos} preguntas` : ' · sin preguntas'}
                            {cuenta.palabras > 0 ? ` · ${cuenta.palabras} palabras` : ''}
                          </div>
                        </div>
                        <div className="botonera">
                          {dentro && (
                            <button
                              type="button"
                              className="boton boton-chico"
                              onClick={() => ir(`/vocabulario?fuente=${fuente.id}&tema=${i}`)}
                            >
                              Vocabulario
                            </button>
                          )}
                          {dentro && !s.cubierta && (
                            <button type="button" className="boton boton-chico boton-guia" onClick={() => ir(`/pasada?fuente=${fuente.id}`)}>
                              Pasada
                            </button>
                          )}
                          {dentro && cuantos === 0 && (
                            <button type="button" className="boton boton-chico" onClick={() => setPidiendo({ fuente, indice: i })}>
                              Preguntas
                            </button>
                          )}
                          {dentro && (
                            <button type="button" className="boton boton-chico" onClick={() => alternarCubierta(fuente, i)}>
                              {s.cubierta ? 'Marcar sin ver' : 'Ya la sé'}
                            </button>
                          )}
                          <button type="button" className="boton boton-chico" onClick={() => marcarHasta(fuente, i)} aria-pressed={i === tope}>
                            {i === tope ? 'Hasta acá ✓' : 'Hasta acá'}
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          )
        })
      )}

      {armando && (
        <ArmarMapa fuente={armando} nombreCurso={curso.nombre} onCerrar={() => setArmandoId(null)} />
      )}

      {pidiendo && (
        <PedirPreguntas
          fuente={pidiendo.fuente}
          seccion={mapaDe(pidiendo.fuente)[pidiendo.indice]}
          nombreCurso={curso.nombre}
          bloques={[...new Set(items.map((i) => i.bloque).filter(Boolean))]}
          onCerrar={() => setPidiendo(null)}
        />
      )}
    </div>
  )
}

/** Pide a Claude las preguntas de UN tema y las guarda amarradas a él. */
function PedirPreguntas({
  fuente,
  seccion,
  nombreCurso,
  bloques,
  onCerrar,
}: {
  fuente: Fuente
  seccion: SeccionApunte
  nombreCurso: string
  bloques: string[]
  onCerrar: () => void
}) {
  const texto = textoDeSeccion(fuente.texto, seccion)
  const trozos = useMemo(() => partirTexto(texto), [texto])
  const [parte, setParte] = useState(0)
  const [oral, setOral] = useState(false)
  const [pegado, setPegado] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function guardar() {
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
    const validado = validarPaquete(bruto)
    if (!validado.ok) {
      setError(`${validado.errores[0].donde}: ${validado.errores[0].mensaje}`)
      return
    }
    // El tema y la sección los pone la app, no Claude: así el mapa no se rompe.
    const nuevos = aItems(validado.items, fuente.cursoId, 'json').map((i) => ({
      ...i,
      id: nuevoId(),
      bloque: fuente.bloque,
      seccion: seccion.titulo,
    }))
    await guardarItems(nuevos)
    setAviso(`${nuevos.length} preguntas guardadas en “${seccion.titulo}”.`)
    setPegado('')
  }

  return (
    <div className="hoja hoja-aviso">
      <div className="titulo-seccion">
        <h3>Preguntas de “{presentar(seccion.titulo)}”</h3>
        <button type="button" className="boton boton-chico" onClick={onCerrar}>Cerrar</button>
      </div>

      {aviso && <p className="verde">{aviso}</p>}
      {error && <div className="aviso-error">{error}</div>}

      <p className="apunte">
        Copia el pedido, pégalo en Claude y trae su respuesta acá. Solo va el texto de este tema, no
        el apunte entero.
      </p>

      <label className="marca-check" style={{ padding: '0.35rem 0' }}>
        <input type="checkbox" checked={oral} onChange={(e) => setOral(e.target.checked)} />
        <span>La prueba es oral: más repreguntas encadenadas</span>
      </label>

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
          className="boton boton-chico boton-fuerte"
          onClick={async () => {
            const listo = await copiar(armarPedido({
              curso: nombreCurso,
              bloques,
              trozo: trozos[parte] ?? { numero: 1, total: 1, texto },
              orientacionOral: oral,
            }))
            setAviso(listo ? 'Pedido copiado. Pégalo en Claude.' : 'No se pudo copiar solo.')
          }}
        >
          Copiar el pedido
        </button>
      </div>

      <label className="campo" style={{ marginTop: '0.7rem' }}>
        <span>Pega acá la respuesta de Claude</span>
        <textarea rows={4} value={pegado} onChange={(e) => setPegado(e.target.value)} />
      </label>
      <button type="button" className="boton boton-chico" disabled={!pegado.trim()} onClick={guardar}>
        Guardar las preguntas de este tema
      </button>
    </div>
  )
}

/**
 * Le pide a Claude que lea el apunte y diga en qué temas se parte.
 *
 * El corte del apunte manda sobre todo lo que viene después: el vocabulario y
 * las preguntas se piden POR TEMA, así que un tema mal cortado arruina los dos
 * aunque Claude los haga bien. La app sabe partirlo sola buscando títulos,
 * pero eso es reconocer formato, no entender de qué trata el apunte.
 */
function ArmarMapa({
  fuente,
  nombreCurso,
  onCerrar,
}: {
  fuente: Fuente
  nombreCurso: string
  onCerrar: () => void
}) {
  // Un apunte entero no cabe en un pedido: va por trozos grandes.
  const trozos = useMemo(() => partirTexto(fuente.texto, 30000), [fuente.texto])
  const [parte, setParte] = useState(0)
  const [pegado, setPegado] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function traer() {
    setError(null)
    const limpio = limpiarRespuesta(pegado)
    if (!limpio) { setError('Pega la respuesta de Claude.'); return }
    let bruto: { temas?: unknown }
    try {
      bruto = JSON.parse(limpio)
    } catch {
      setError('Eso no es JSON válido. Copia el bloque de código completo.')
      return
    }
    if (!Array.isArray(bruto.temas)) {
      setError('La respuesta no trae una lista de "temas".')
      return
    }
    const temas = (bruto.temas as { titulo?: unknown; empieza?: unknown }[])
      .filter((t) => typeof t?.titulo === 'string' && typeof t?.empieza === 'string')
      .map((t) => ({ titulo: String(t.titulo), empieza: String(t.empieza) }))
    if (temas.length === 0) { setError('No vino ningún tema.'); return }

    const traido = mapaDesdeClaude(fuente.texto, temas)
    if (traido.secciones.length === 0) {
      setError(
        'No pude ubicar ninguno de esos temas en el texto. Pídele a Claude que copie las ' +
        'primeras palabras de cada tema TAL CUAL están en el apunte.',
      )
      return
    }

    // Se acumulan: con un apunte largo esto se hace parte por parte, y la
    // parte 3 no puede borrar los temas de la 1.
    const previas = fuente.temasDeClaude ? fuente.secciones ?? [] : []
    const secciones = fusionarSecciones(fuente.texto, previas, traido.secciones)
    await db.fuentes.put({
      ...fuente,
      secciones,
      temasDeClaude: true,
      hasta: secciones.length - 1,
      avance: 0,
      terminada: secciones.every((x) => x.cubierta),
    })
    setPegado('')
    const sumados = secciones.length - previas.length
    setAviso(
      (previas.length > 0
        ? `${secciones.length} temas en total (${
            sumados > 0 ? `${sumados} ${sumados === 1 ? 'nuevo' : 'nuevos'}` : 'sin temas nuevos'
          }).`
        : `${secciones.length} temas armados.`) +
      (traido.perdidos.length > 0
        ? ` No pude ubicar ${traido.perdidos.length}: ${traido.perdidos.join(', ')}.`
        : ''),
    )
  }

  return (
    <div className="hoja hoja-aviso">
      <div className="titulo-seccion">
        <h3>Los temas de “{fuente.titulo}”</h3>
        <button type="button" className="boton boton-chico" onClick={onCerrar}>Cerrar</button>
      </div>

      {aviso && <p className="verde">{aviso}</p>}
      {error && <div className="aviso-error">{error}</div>}

      <p className="apunte">
        Copia el pedido, pégalo en Claude y trae su respuesta. Claude lee el apunte y decide dónde
        empieza y termina cada tema, y les pone nombre. Los temas que tengas ahora se reemplazan
        por los suyos.
      </p>

      {trozos.length > 1 && (
        <label className="campo">
          <span>El apunte es largo: va en {trozos.length} partes</span>
          <select value={parte} onChange={(e) => setParte(Number(e.target.value))}>
            {trozos.map((t, i) => <option key={i} value={i}>Parte {t.numero} de {t.total}</option>)}
          </select>
          <span className="apunte">
            Hazlas en orden: los temas se van sumando, no se reemplazan.
          </span>
        </label>
      )}

      <div className="botonera">
        <button
          type="button"
          className="boton boton-chico boton-guia"
          onClick={async () => {
            const listo = await copiar(armarPedidoMapa({
              curso: nombreCurso,
              titulo: fuente.titulo,
              trozo: trozos[parte] ?? { numero: 1, total: 1, texto: fuente.texto },
            }))
            setAviso(listo ? 'Pedido copiado. Pégalo en Claude.' : 'No se pudo copiar solo.')
          }}
        >
          Copiar el pedido
        </button>
      </div>

      <label className="campo" style={{ marginTop: '0.7rem' }}>
        <span>Pega acá la respuesta</span>
        <textarea rows={4} value={pegado} onChange={(e) => setPegado(e.target.value)} />
      </label>
      <button type="button" className="boton boton-chico" disabled={!pegado.trim()} onClick={traer}>
        Armar los temas
      </button>
    </div>
  )
}
