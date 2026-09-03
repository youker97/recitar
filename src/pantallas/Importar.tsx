import { useMemo, useState } from 'react'
import { db, guardarAjustes, nuevoId } from '../datos/db'
import { crearCurso, guardarItems } from '../datos/repos'
import { useCursoActivo, useCursos, useItems } from '../datos/hooks'
import { aItems, validarPaquete, type ResultadoValidacion } from '../datos/esquema'
import { convertirApunte } from '../importar/texto'
import type { PaginaPdf } from '../importar/pdf'
import { armarPedido, copiar, limpiarRespuesta, partirTexto } from '../importar/claude'
import { detectarSecciones } from '../logica/mapa'
import { SelectorPaginas } from '../componentes/SelectorPaginas'
import { NOMBRE_TIPO, type OrigenItem, type TipoItem } from '../datos/tipos'
import { ir } from '../rutas'

type Paso = 'elegir' | 'archivos' | 'revisar'

interface Archivo {
  id: string
  nombre: string
  clase: 'pdf' | 'texto' | 'paquete'
  /** Solo PDF. */
  paginas?: PaginaPdf[]
  elegidas: Set<number>
  /** Texto completo para los archivos de texto; crudo para los paquetes. */
  texto: string
  bloque: string
  incluir: boolean
  paquete?: ResultadoValidacion
  origen: OrigenItem
}

function nombreABloque(nombre: string): string {
  const limpio = nombre
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return limpio.charAt(0).toUpperCase() + limpio.slice(1)
}

function textoDe(archivo: Archivo): string {
  if (archivo.clase !== 'pdf' || !archivo.paginas) return archivo.texto
  return archivo.paginas
    .filter((p) => archivo.elegidas.has(p.numero))
    .map((p) => p.texto)
    .join('\n\n')
}

export function Importar() {
  const cursos = useCursos()
  const curso = useCursoActivo()
  const items = useItems(curso?.id)
  const bloquesUsados = useMemo(
    () => [...new Set(items.map((i) => i.bloque).filter(Boolean))].sort(),
    [items],
  )

  const [paso, setPaso] = useState<Paso>('elegir')
  const [archivos, setArchivos] = useState<Archivo[]>([])
  const [cargando, setCargando] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Puente con Claude
  const [archivoClaude, setArchivoClaude] = useState<string>('')
  const [trozoActual, setTrozoActual] = useState(0)
  const [oral, setOral] = useState(false)
  const [pegado, setPegado] = useState('')
  const [validado, setValidado] = useState<ResultadoValidacion | null>(null)
  const [restos, setRestos] = useState<string[]>([])
  const [nombreCurso, setNombreCurso] = useState('')
  // 'nuevo' significa que este material abre un curso propio.
  const [destino, setDestino] = useState<string>('')

  // A qué curso va el material. Sin curso todavía, este material abre uno.
  const elegido = destino || (!curso ? 'nuevo' : curso.id)
  const faltaNombre = elegido === 'nuevo' && nombreCurso.trim().length === 0
  const nombreDestino = elegido === 'nuevo'
    ? nombreCurso.trim()
    : cursos.find((c) => c.id === elegido)?.nombre ?? ''

  const elegidoParaClaude = archivos.find((a) => a.id === archivoClaude) ?? archivos.find((a) => a.clase !== 'paquete')
  const trozos = useMemo(
    () => (elegidoParaClaude ? partirTexto(textoDe(elegidoParaClaude)) : []),
    [elegidoParaClaude],
  )

  function actualizar(id: string, cambios: Partial<Archivo>) {
    setArchivos((prev) => prev.map((a) => (a.id === id ? { ...a, ...cambios } : a)))
  }

  async function alElegirArchivos(lista: File[]) {
    setError(null)
    setAviso(null)
    const nuevos: Archivo[] = []
    const total = lista.length

    for (let i = 0; i < total; i++) {
      const archivo = lista[i]
      const nombre = archivo.name
      const minuscula = nombre.toLowerCase()
      try {
        if (minuscula.endsWith('.pdf')) {
          setCargando(`Leyendo ${nombre} (${i + 1} de ${total})…`)
          const { extraerTextoPdf } = await import('../importar/pdf')
          const paginas = await extraerTextoPdf(archivo, (hecha, cuantas) =>
            setCargando(`Leyendo ${nombre} (${i + 1} de ${total}) — página ${hecha} de ${cuantas}`),
          )
          nuevos.push({
            id: nuevoId('a'),
            nombre,
            clase: 'pdf',
            paginas,
            elegidas: new Set(paginas.filter((p) => p.texto.trim().length > 40).map((p) => p.numero)),
            texto: '',
            bloque: nombreABloque(nombre),
            incluir: true,
            origen: 'pdf',
          })
          continue
        }

        const contenido = await archivo.text()

        if (minuscula.endsWith('.json')) {
          let bruto: unknown
          try {
            bruto = JSON.parse(contenido)
          } catch {
            setError(`${nombre}: no es JSON válido. Puede que se haya cortado al copiarlo.`)
            continue
          }
          if (typeof bruto === 'object' && bruto !== null && 'recitarRespaldo' in bruto) {
            setError(`${nombre} es un respaldo completo. Restáuralo desde Ajustes › Respaldo.`)
            continue
          }
          nuevos.push({
            id: nuevoId('a'),
            nombre,
            clase: 'paquete',
            elegidas: new Set(),
            texto: contenido,
            bloque: '',
            incluir: true,
            paquete: validarPaquete(bruto),
            origen: 'json',
          })
          continue
        }

        nuevos.push({
          id: nuevoId('a'),
          nombre,
          clase: 'texto',
          elegidas: new Set(),
          texto: contenido,
          bloque: nombreABloque(nombre),
          incluir: true,
          origen: minuscula.endsWith('.md') ? 'md' : 'txt',
        })
      } catch (e) {
        setError(`${nombre}: ${e instanceof Error ? e.message : 'no se pudo leer'}`)
      }
    }

    setCargando(null)
    if (nuevos.length === 0) return
    setArchivos((prev) => [...prev, ...nuevos])
    setPaso('archivos')
  }

  async function asegurarCurso(): Promise<string> {
    if (elegido !== 'nuevo') return elegido
    const creado = await crearCurso(nombreCurso.trim() || 'Curso sin nombre')
    await guardarAjustes({ cursoActivoId: creado.id })
    return creado.id
  }

  /** Guarda los apuntes como material y los paquetes como ítems. */
  async function guardarTodo() {
    const incluidos = archivos.filter((a) => a.incluir)
    if (incluidos.length === 0) { setError('No hay ningún archivo marcado.'); return }
    setError(null)
    const cursoId = await asegurarCurso()

    let apuntes = 0
    let guardados = 0
    let repetidos = 0
    const problemas: string[] = []

    // Huella de lo que ya está guardado, para no duplicar el mismo apunte.
    const yaEstan = new Set(
      (await db.fuentes.where('cursoId').equals(cursoId).toArray()).map(
        (f) => `${f.titulo}|${f.texto.length}`,
      ),
    )

    for (const archivo of incluidos) {
      if (archivo.clase === 'paquete') {
        if (!archivo.paquete?.ok) {
          problemas.push(`${archivo.nombre}: ${archivo.paquete?.errores[0]?.mensaje ?? 'paquete inválido'}`)
          continue
        }
        const nuevos = aItems(archivo.paquete.items, cursoId, 'json')
        await guardarItems(nuevos)
        guardados += nuevos.length
        continue
      }

      const texto = textoDe(archivo).trim()
      if (texto.length < 300) {
        problemas.push(`${archivo.nombre}: quedó muy corto (${texto.length} caracteres)`)
        continue
      }
      const huella = `${archivo.nombre}|${texto.length}`
      if (yaEstan.has(huella)) {
        repetidos++
        continue
      }
      yaEstan.add(huella)

      const secciones = detectarSecciones(texto)
      await db.fuentes.put({
        id: nuevoId('f'),
        cursoId,
        bloque: archivo.bloque.trim() || nombreABloque(archivo.nombre),
        titulo: archivo.nombre,
        texto,
        creadoEn: Date.now(),
        secciones,
        hasta: secciones.length - 1,
        avance: 0,
        terminada: false,
      })
      apuntes++
    }

    const partes: string[] = []
    if (apuntes > 0) partes.push(`${apuntes} ${apuntes === 1 ? 'apunte guardado' : 'apuntes guardados'}`)
    if (guardados > 0) partes.push(`${guardados} ítems`)
    if (repetidos > 0) {
      partes.push(`${repetidos} ${repetidos === 1 ? 'estaba repetido y no se volvió a guardar' : 'estaban repetidos y no se volvieron a guardar'}`)
    }
    if (problemas.length > 0) setError(problemas.join(' · '))
    setAviso(partes.join(' y ') || null)

    if (apuntes === 0 && guardados === 0 && repetidos === 0) return

    setArchivos((prev) => prev.filter((a) => !a.incluir))
    // Si hubo algo que contar (repetidos o problemas), el aviso se queda a la
    // vista en vez de perderse al cambiar de pantalla.
    if (repetidos === 0 && problemas.length === 0) {
      ir(apuntes > 0 ? '/mapa' : '/material')
    }
  }

  function convertirConMarcas(archivo: Archivo) {
    const resultado = convertirApunte(textoDe(archivo))
    setRestos(resultado.restos)
    if (resultado.items.length === 0) {
      setError('No se reconoció ningún ítem con las marcas. Guárdalo como material y usa a Claude tema por tema desde el mapa.')
      return
    }
    setError(null)
    setValidado(validarPaquete({ curso: curso?.nombre, items: aBrutos(resultado.items) }))
    setPaso('revisar')
  }

  function revisarPegado() {
    setError(null)
    const limpio = limpiarRespuesta(pegado)
    if (!limpio) { setError('Pega la respuesta de Claude en el recuadro.'); return }
    let bruto: unknown
    try {
      bruto = JSON.parse(limpio)
    } catch (e) {
      setError(
        `El texto pegado no es JSON válido (${e instanceof Error ? e.message : 'error'}). Copia el bloque de código completo, con la llave del principio y la del final.`,
      )
      return
    }
    setValidado(validarPaquete(bruto))
    setPaso('revisar')
  }

  async function guardarRevisado(aCursoNuevo: boolean) {
    if (!validado?.ok) return
    let cursoId = curso?.id
    if (aCursoNuevo || !cursoId) {
      const creado = await crearCurso(nombreCurso.trim() || validado.curso || 'Mi curso')
      cursoId = creado.id
      await guardarAjustes({ cursoActivoId: cursoId })
    }
    const nuevos = aItems(validado.items, cursoId, 'json')
    await guardarItems(nuevos)
    setValidado(null)
    setPegado('')
    setAviso(`Se guardaron ${nuevos.length} ítems.`)
    setPaso(archivos.length > 0 ? 'archivos' : 'elegir')
    ir('/material')
  }

  return (
    <div>
      <div className="titulo-seccion">
        <h1>Importar</h1>
        {archivos.length > 0 && (
          <button
            type="button"
            className="boton boton-chico"
            onClick={() => { setArchivos([]); setValidado(null); setPegado(''); setPaso('elegir') }}
          >
            Vaciar
          </button>
        )}
      </div>

      {aviso && (
        <div className="hoja hoja-bien">
          {aviso}
          <p style={{ margin: '0.5rem 0 0' }}>
            <a className="boton boton-chico" href="#/mapa">Ver el mapa</a>
          </p>
        </div>
      )}
      {error && <div className="aviso-error">{error}</div>}
      {cargando && <p className="apunte">{cargando}</p>}

      {paso !== 'revisar' && (
        <div className="hoja hoja-aviso">
          <label className="campo" style={{ marginBottom: elegido === 'nuevo' ? '0.6rem' : 0 }}>
            <span>Este material va a</span>
            <select
              value={elegido}
              onChange={(e) => {
                setDestino(e.target.value)
                if (e.target.value !== 'nuevo') guardarAjustes({ cursoActivoId: e.target.value })
              }}
            >
              {cursos.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
              <option value="nuevo">＋ Un curso nuevo</option>
            </select>
          </label>
          {elegido === 'nuevo' && (
            <label className="campo" style={{ marginBottom: 0 }}>
              <span>Cómo se llama el curso</span>
              <input
                type="text"
                value={nombreCurso}
                placeholder="Derecho Penal II"
                onChange={(e) => setNombreCurso(e.target.value)}
              />
              <span className="apunte">
                Un curso por ramo: "Derecho Penal II", "Civil III". Los apuntes de ese ramo van
                todos adentro y se estudian juntos.
              </span>
            </label>
          )}
        </div>
      )}

      {paso !== 'revisar' && (
        <div className="botonera seccion">
          <label className="boton boton-fuerte">
            {archivos.length > 0 ? 'Agregar más archivos' : 'Elegir archivos'}
            <input
              type="file"
              multiple
              accept=".json,.md,.txt,.pdf,application/json,text/markdown,text/plain,application/pdf"
              className="oculto-visual"
              onChange={(e) => {
                // Se copia la lista antes de limpiar el input: al vaciarlo, el
                // FileList original queda inutilizable a mitad de la lectura.
                const elegidos = Array.from(e.target.files ?? [])
                e.target.value = ''
                if (elegidos.length > 0) alElegirArchivos(elegidos)
              }}
            />
          </label>
          <button
            type="button"
            className="boton"
            onClick={() => {
              setArchivos((prev) => [...prev, {
                id: nuevoId('a'), nombre: 'Texto pegado', clase: 'texto', elegidas: new Set(),
                texto: '', bloque: '', incluir: true, origen: 'txt',
              }])
              setPaso('archivos')
            }}
          >
            Pegar texto a mano
          </button>
        </div>
      )}

      {paso === 'elegir' && (
        <>
          <p className="apunte">
            Puedes elegir <strong>varios archivos de una vez</strong>: los PDF y apuntes de un ramo
            entero, o paquetes de ítems que ya tengas. Cada archivo queda como un apunte aparte, con
            su propio tema.
          </p>
          <ChuletaMarcas />
        </>
      )}

      {paso === 'archivos' && (
        <>
          <p className="apunte">
            Primero se guardan como <strong>material</strong>: el texto queda en la app para darle la
            primera pasada y hacer volcados. Las preguntas se generan después, tema por tema, desde
            el mapa. Así un apunte de 300 hojas no obliga a hacer todo de una.
          </p>

          {archivos.map((archivo) => (
            <section key={archivo.id} className="hoja">
              <div className="titulo-seccion">
                <h2 style={{ fontSize: '1rem' }}>{archivo.nombre}</h2>
                <label className="marca-check">
                  <input
                    type="checkbox"
                    checked={archivo.incluir}
                    onChange={(e) => actualizar(archivo.id, { incluir: e.target.checked })}
                  />
                  <span className="apunte">incluir</span>
                </label>
              </div>

              {archivo.clase === 'paquete' ? (
                <p className="apunte">
                  {archivo.paquete?.ok
                    ? `Paquete de ítems listo: ${Object.entries(archivo.paquete.resumen).map(([t, n]) => `${n} ${NOMBRE_TIPO[t as TipoItem] ?? t}`).join(' · ')}`
                    : `No se puede guardar: ${archivo.paquete?.errores[0]?.donde} — ${archivo.paquete?.errores[0]?.mensaje}`}
                </p>
              ) : (
                <>
                  <label className="campo">
                    <span>Tema (así se agrupa en el mapa y en el material)</span>
                    <input
                      type="text"
                      list="temas-usados"
                      value={archivo.bloque}
                      placeholder="Ej: Antijuridicidad"
                      onChange={(e) => actualizar(archivo.id, { bloque: e.target.value })}
                    />
                  </label>

                  {archivo.clase === 'pdf' && archivo.paginas && (
                    <SelectorPaginas
                      paginas={archivo.paginas}
                      elegidas={archivo.elegidas}
                      onCambiar={(nuevas) => actualizar(archivo.id, { elegidas: nuevas })}
                    />
                  )}

                  {archivo.clase === 'texto' && (
                    <label className="campo">
                      <span>Texto</span>
                      <textarea
                        rows={archivo.texto ? 6 : 10}
                        value={archivo.texto}
                        placeholder="Pega acá el apunte"
                        onChange={(e) => actualizar(archivo.id, { texto: e.target.value })}
                      />
                      <span className="contador">{archivo.texto.length.toLocaleString('es-CL')} caracteres</span>
                    </label>
                  )}

                  <div className="botonera">
                    <button
                      type="button"
                      className="boton boton-chico"
                      onClick={() => { setArchivoClaude(archivo.id); setTrozoActual(0) }}
                      aria-pressed={elegidoParaClaude?.id === archivo.id}
                    >
                      Preparar preguntas de este
                    </button>
                    <button type="button" className="boton boton-chico" onClick={() => convertirConMarcas(archivo)}>
                      Convertir con las marcas
                    </button>
                    <button
                      type="button"
                      className="boton boton-chico boton-peligro"
                      onClick={() => setArchivos((prev) => prev.filter((a) => a.id !== archivo.id))}
                    >
                      Sacar
                    </button>
                  </div>
                </>
              )}
            </section>
          ))}

          <datalist id="temas-usados">
            {bloquesUsados.map((b) => <option key={b} value={b} />)}
          </datalist>

          <div className="pie-fijo">
            <button
              type="button"
              className="boton boton-fuerte boton-ancho"
              disabled={faltaNombre}
              onClick={guardarTodo}
            >
              {faltaNombre
                ? 'Ponle nombre al curso'
                : `Guardar ${archivos.filter((a) => a.incluir).length} ${
                    archivos.filter((a) => a.incluir).length === 1 ? 'archivo' : 'archivos'
                  } en “${nombreDestino}”`}
            </button>
          </div>

          <hr className="filete" />

          {elegidoParaClaude && (
            <section className="seccion">
              <div className="titulo-seccion">
                <h2>Preguntas con Claude</h2>
                <span className="lado">{elegidoParaClaude.nombre}</span>
              </div>
              <p className="apunte">
                Opcional acá: también puedes guardar el material y pedirle a Claude tema por tema
                desde el mapa, que es más liviano para un apunte largo.
              </p>

              <label className="marca-check" style={{ padding: '0.4rem 0' }}>
                <input type="checkbox" checked={oral} onChange={(e) => setOral(e.target.checked)} />
                <span>La prueba es oral: más repreguntas encadenadas</span>
              </label>

              {trozos.length > 1 && (
                <label className="campo">
                  <span>Va por partes ({trozos.length} en total)</span>
                  <select value={trozoActual} onChange={(e) => setTrozoActual(Number(e.target.value))}>
                    {trozos.map((t, i) => <option key={i} value={i}>Parte {t.numero} de {t.total}</option>)}
                  </select>
                </label>
              )}

              <div className="botonera">
                <button
                  type="button"
                  className="boton boton-fuerte"
                  disabled={trozos.length === 0}
                  onClick={async () => {
                    const trozo = trozos[trozoActual] ?? trozos[0]
                    const listo = await copiar(armarPedido({
                      curso: curso?.nombre ?? 'Mi curso',
                      bloques: bloquesUsados,
                      trozo,
                      orientacionOral: oral,
                    }))
                    setAviso(listo ? 'Pedido copiado. Pégalo en Claude y trae la respuesta acá.' : 'No se pudo copiar solo.')
                  }}
                >
                  Copiar el pedido para Claude
                </button>
              </div>

              <label className="campo" style={{ marginTop: '1rem' }}>
                <span>Pega acá la respuesta de Claude</span>
                <textarea rows={5} value={pegado} onChange={(e) => setPegado(e.target.value)} />
              </label>
              <button type="button" className="boton" disabled={!pegado.trim()} onClick={revisarPegado}>
                Revisar lo que trajo Claude
              </button>
            </section>
          )}

          <ChuletaMarcas />
        </>
      )}

      {paso === 'revisar' && validado && (
        <section className="seccion">
          <div className="titulo-seccion">
            <h2>Revisión</h2>
            <span className="lado numeral">{validado.items.length} ítems</span>
          </div>

          {validado.errores.length > 0 && (
            <div className="aviso-error">
              <strong>Hay {validado.errores.length} problemas. No se guarda nada hasta arreglarlos:</strong>
              <ul style={{ margin: '0.4rem 0 0 1rem', padding: 0 }}>
                {validado.errores.slice(0, 25).map((e, i) => (
                  <li key={i}><strong>{e.donde}:</strong> {e.mensaje}</li>
                ))}
              </ul>
              {validado.errores.length > 25 && <p style={{ margin: '0.4rem 0 0' }}>…y {validado.errores.length - 25} más.</p>}
            </div>
          )}

          <ul className="lista-limpia">
            {Object.entries(validado.resumen).map(([tipo, cuantos]) => (
              <li key={tipo} className="renglon">
                <span className="crece">{NOMBRE_TIPO[tipo as TipoItem] ?? tipo}</span>
                <span className="numeral">{cuantos}</span>
              </li>
            ))}
          </ul>

          {restos.length > 0 && (
            <details style={{ marginTop: '1rem' }}>
              <summary className="apunte">{restos.length} líneas quedaron fuera (no tenían marca)</summary>
              <ul className="apunte" style={{ maxHeight: '14rem', overflow: 'auto' }}>
                {restos.slice(0, 100).map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </details>
          )}

          <div className="botonera seccion">
            <button type="button" className="boton" onClick={() => setPaso(archivos.length > 0 ? 'archivos' : 'elegir')}>
              Volver
            </button>
          </div>

          {validado.ok && (
            <>
              <hr className="filete" />
              <label className="campo">
                <span>Nombre del curso, si lo vas a crear nuevo</span>
                <input type="text" value={nombreCurso} placeholder={validado.curso ?? 'Mi curso'} onChange={(e) => setNombreCurso(e.target.value)} />
              </label>
              <div className="botonera-columna">
                {curso && (
                  <button type="button" className="boton boton-fuerte boton-ancho" onClick={() => guardarRevisado(false)}>
                    Guardar en “{curso.nombre}”
                  </button>
                )}
                <button type="button" className="boton boton-ancho" onClick={() => guardarRevisado(true)}>
                  {cursos.length === 0 ? 'Crear el curso y guardar' : 'Guardar en un curso nuevo'}
                </button>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  )
}

function aBrutos(items: ReturnType<typeof convertirApunte>['items']): unknown[] {
  return items.map((i) => ({
    tipo: i.tipo,
    bloque: i.bloque,
    seccion: i.seccion,
    ref: i.ref,
    ...(i.datos as object),
    hijos: aBrutos(i.hijos),
  }))
}

function ChuletaMarcas() {
  return (
    <details className="seccion">
      <summary><strong>Chuleta de marcas para .md y .txt</strong></summary>
      <pre
        className="apunte"
        style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--mono)', fontSize: '0.78rem', lineHeight: 1.6 }}
      >{`## Obligaciones            ← cambia el tema
[art. 1489 CC]            ← referencia para lo que viene

F: La condición resolutoria tácita opera de pleno derecho.
J: Requiere sentencia; el 1489 da la opción de cumplimiento o resolución.
? ¿Y la ordinaria?        ← repregunta del ítem de arriba
= Esa sí opera de pleno derecho. [art. 1479]

LISTA: Requisitos del acto jurídico [art. 1445]
- capaz
- consentimiento sin vicios

ALT: ¿Qué exige la resolución por incumplimiento?
- Opera de pleno derecho
+ Sentencia judicial que la declare
- Basta una carta del acreedor

ART 1698: carga de la prueba
TEXTO 1545: Todo contrato legalmente celebrado es una ley para los contratantes...
TRIAJE(posturas): Refiérase a la culpa en abstracto o en concreto.
DES: Explique los elementos de la responsabilidad extracontractual
- capacidad
- daño`}</pre>
    </details>
  )
}
