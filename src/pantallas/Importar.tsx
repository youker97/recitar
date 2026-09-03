import { useMemo, useState } from 'react'
import { guardarAjustes } from '../datos/db'
import { crearCurso, guardarItems } from '../datos/repos'
import { useCursoActivo, useCursos, useItems } from '../datos/hooks'
import { aItems, validarPaquete, type ResultadoValidacion } from '../datos/esquema'
import { convertirApunte } from '../importar/texto'
import type { PaginaPdf } from '../importar/pdf'
import { armarPedido, copiar, limpiarRespuesta, partirTexto } from '../importar/claude'
import { NOMBRE_TIPO, type OrigenItem, type TipoItem } from '../datos/tipos'
import { ir } from '../rutas'

type Paso = 'elegir' | 'texto' | 'revisar'

export function Importar() {
  const cursos = useCursos()
  const curso = useCursoActivo()
  const items = useItems(curso?.id)
  const bloques = useMemo(
    () => [...new Set(items.map((i) => i.bloque).filter(Boolean))].sort(),
    [items],
  )

  const [paso, setPaso] = useState<Paso>('elegir')
  const [texto, setTexto] = useState('')
  const [paginas, setPaginas] = useState<PaginaPdf[] | null>(null)
  const [elegidas, setElegidas] = useState<Set<number>>(new Set())
  const [validado, setValidado] = useState<ResultadoValidacion | null>(null)
  const [origen, setOrigen] = useState<OrigenItem>('json')
  const [restos, setRestos] = useState<string[]>([])
  const [pegado, setPegado] = useState('')
  const [trozoActual, setTrozoActual] = useState(0)
  const [oral, setOral] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState<string | null>(null)
  const [nombreCurso, setNombreCurso] = useState('')

  const trozos = useMemo(() => (texto ? partirTexto(texto) : []), [texto])

  function reiniciar() {
    setPaso('elegir'); setTexto(''); setPaginas(null); setElegidas(new Set())
    setValidado(null); setRestos([]); setPegado(''); setTrozoActual(0)
    setAviso(null); setError(null); setNombreCurso('')
  }

  async function alElegirArchivo(archivo: File) {
    setError(null); setAviso(null); setValidado(null); setRestos([])
    const nombre = archivo.name.toLowerCase()
    try {
      if (nombre.endsWith('.pdf')) {
        setCargando('Leyendo el PDF…')
        // pdf.js pesa: se carga solo cuando de verdad hay un PDF.
        const { extraerTextoPdf } = await import('../importar/pdf')
        const leidas = await extraerTextoPdf(archivo, (hecha, total) =>
          setCargando(`Leyendo el PDF… página ${hecha} de ${total}`),
        )
        setPaginas(leidas)
        setElegidas(new Set(leidas.map((p) => p.numero)))
        setTexto(leidas.map((p) => p.texto).join('\n\n'))
        setOrigen('pdf')
        setPaso('texto')
        setCargando(null)
        return
      }

      const contenido = await archivo.text()

      if (nombre.endsWith('.json')) {
        let bruto: unknown
        try {
          bruto = JSON.parse(contenido)
        } catch {
          setError('El archivo no es JSON válido. Puede que se haya cortado al copiarlo.')
          return
        }
        if (typeof bruto === 'object' && bruto !== null && 'recitarRespaldo' in bruto) {
          setError('Esto es un respaldo completo, no un paquete de ítems. Restáuralo desde Ajustes › Respaldo.')
          return
        }
        const resultado = validarPaquete(bruto)
        setValidado(resultado)
        setOrigen('json')
        setNombreCurso(resultado.curso ?? '')
        setPaso('revisar')
        return
      }

      setTexto(contenido)
      setOrigen(nombre.endsWith('.md') ? 'md' : 'txt')
      setPaso('texto')
    } catch (e) {
      setCargando(null)
      setError(e instanceof Error ? e.message : 'No se pudo leer el archivo.')
    }
  }

  function convertirAqui() {
    const resultado = convertirApunte(texto)
    setRestos(resultado.restos)
    if (resultado.items.length === 0) {
      setError(
        'No se reconoció ningún ítem con las marcas. Revisa la chuleta de abajo, o mándaselo a Claude: es lo que mejor funciona con un apunte normal.',
      )
      return
    }
    setError(null)
    const paquete = validarPaquete({ curso: curso?.nombre, items: aBrutos(resultado.items) })
    setValidado(paquete)
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
        `El texto pegado no es JSON válido (${e instanceof Error ? e.message : 'error'}). Copia de nuevo desde el bloque de código completo, incluyendo la llave del principio y la del final.`,
      )
      return
    }
    const resultado = validarPaquete(bruto)
    setValidado(resultado)
    setOrigen('json')
    setNombreCurso(resultado.curso ?? '')
    setPaso('revisar')
  }

  async function guardar(aCursoNuevo: boolean) {
    if (!validado?.ok) return
    let cursoId = curso?.id
    if (aCursoNuevo || !cursoId) {
      const creado = await crearCurso(nombreCurso.trim() || validado.curso || 'Curso sin nombre')
      cursoId = creado.id
      await guardarAjustes({ cursoActivoId: cursoId })
    }
    const nuevos = aItems(validado.items, cursoId, origen)
    await guardarItems(nuevos)
    setAviso(`Se guardaron ${nuevos.length} ítems.`)
    setValidado(null)
    setPaso('elegir')
    setTexto('')
    setPegado('')
    ir('/material')
  }

  const textoSeleccionado = paginas
    ? paginas.filter((p) => elegidas.has(p.numero)).map((p) => p.texto).join('\n\n')
    : texto

  return (
    <div>
      <div className="titulo-seccion">
        <h1>Importar material</h1>
        {paso !== 'elegir' && (
          <button type="button" className="boton boton-chico" onClick={reiniciar}>Empezar de nuevo</button>
        )}
      </div>

      {aviso && <div className="hoja hoja-bien">{aviso}</div>}
      {error && <div className="aviso-error">{error}</div>}
      {cargando && <p className="apunte">{cargando}</p>}

      {paso === 'elegir' && (
        <>
          <p className="apunte">
            Puedes traer un paquete de ítems (.json), un apunte (.md o .txt) o un PDF. También puedes
            pegar el texto directamente.
          </p>

          <div className="botonera seccion">
            <label className="boton boton-fuerte">
              Elegir un archivo
              <input
                type="file"
                accept=".json,.md,.txt,.pdf,application/json,text/markdown,text/plain,application/pdf"
                className="oculto-visual"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) alElegirArchivo(f) }}
              />
            </label>
            <button type="button" className="boton" onClick={() => setPaso('texto')}>
              Pegar texto a mano
            </button>
          </div>

          <hr className="filete" />
          <ChuletaMarcas />
        </>
      )}

      {paso === 'texto' && (
        <>
          {paginas && (
            <section className="seccion">
              <div className="titulo-seccion">
                <h2>Elige qué páginas usar</h2>
                <span className="lado numeral">{elegidas.size} de {paginas.length}</span>
              </div>
              <p className="apunte">
                Los PDF traen carátulas, índices y basura. Marca solo lo que sirve.
              </p>
              <ul className="lista-limpia">
                {paginas.map((p) => (
                  <li key={p.numero} className="renglon">
                    <label className="marca-check crece" style={{ alignItems: 'flex-start' }}>
                      <input
                        type="checkbox"
                        checked={elegidas.has(p.numero)}
                        onChange={(e) => {
                          const copia = new Set(elegidas)
                          if (e.target.checked) copia.add(p.numero)
                          else copia.delete(p.numero)
                          setElegidas(copia)
                          setTexto(
                            paginas.filter((x) => copia.has(x.numero)).map((x) => x.texto).join('\n\n'),
                          )
                        }}
                      />
                      <span className="crece">
                        <strong>Página {p.numero}</strong>
                        <br />
                        <span className="apunte">
                          {p.texto.slice(0, 160).replace(/\s+/g, ' ') || '(sin texto: puede ser una imagen escaneada)'}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <label className="campo">
            <span>Texto del apunte (puedes corregirlo acá mismo)</span>
            <textarea
              rows={12}
              value={paginas ? textoSeleccionado : texto}
              onChange={(e) => { setTexto(e.target.value); setPaginas(null) }}
            />
            <span className="contador">{textoSeleccionado.length.toLocaleString('es-CL')} caracteres</span>
          </label>

          <hr className="filete" />

          <section className="seccion">
            <div className="titulo-seccion">
              <h2>Pásaselo a Claude</h2>
              <span className="lado">lo que mejor funciona</span>
            </div>
            <p className="apunte">
              La app arma el pedido completo: copias, lo pegas en Claude, y Claude te devuelve las
              preguntas y las repreguntas ya armadas. Después pegas su respuesta acá abajo. La app
              no manda nada por su cuenta: tú decides qué sale de aquí.
            </p>

            <label className="marca-check" style={{ padding: '0.4rem 0' }}>
              <input type="checkbox" checked={oral} onChange={(e) => setOral(e.target.checked)} />
              <span>La prueba es oral: pídele más repreguntas encadenadas</span>
            </label>

            {trozos.length > 1 && (
              <label className="campo">
                <span>El apunte es largo: va por partes</span>
                <select value={trozoActual} onChange={(e) => setTrozoActual(Number(e.target.value))}>
                  {trozos.map((t, i) => (
                    <option key={i} value={i}>Parte {t.numero} de {t.total}</option>
                  ))}
                </select>
                <span className="apunte">
                  Copia una parte, pégala en Claude, trae la respuesta, y vuelve por la siguiente.
                </span>
              </label>
            )}

            <div className="botonera">
              <button
                type="button"
                className="boton boton-fuerte"
                disabled={!textoSeleccionado.trim()}
                onClick={async () => {
                  const trozo = trozos[trozoActual] ?? { numero: 1, total: 1, texto: textoSeleccionado }
                  const pedido = armarPedido({
                    curso: curso?.nombre ?? 'Mi curso',
                    bloques,
                    trozo,
                    orientacionOral: oral,
                  })
                  const listo = await copiar(pedido)
                  setAviso(
                    listo
                      ? 'Pedido copiado. Ábrelo en Claude, pégalo y trae la respuesta de vuelta acá.'
                      : 'No se pudo copiar solo. Selecciona el texto de abajo y cópialo a mano.',
                  )
                  if (!listo) setPegado(pedido)
                }}
              >
                Copiar el pedido para Claude
              </button>
            </div>

            <label className="campo" style={{ marginTop: '1rem' }}>
              <span>Pega acá la respuesta de Claude</span>
              <textarea
                rows={6}
                value={pegado}
                placeholder='{ "recitar": 1, "curso": "...", "items": [ ... ] }'
                onChange={(e) => setPegado(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="boton"
              disabled={!pegado.trim()}
              onClick={revisarPegado}
            >
              Revisar lo que trajo Claude
            </button>
          </section>

          <hr className="filete" />

          <section className="seccion">
            <h2>O convertirlo aquí mismo, sin internet</h2>
            <p className="apunte">
              Funciona si el apunte usa las marcas de la chuleta. Si es texto corrido, va a reconocer
              poco: para eso está Claude.
            </p>
            <button
              type="button"
              className="boton"
              disabled={!textoSeleccionado.trim()}
              onClick={convertirAqui}
            >
              Convertir con las marcas
            </button>
          </section>

          <ChuletaMarcas />
        </>
      )}

      {paso === 'revisar' && validado && (
        <>
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
                {validado.errores.length > 25 && (
                  <p style={{ margin: '0.4rem 0 0' }}>…y {validado.errores.length - 25} más.</p>
                )}
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
                <summary className="apunte">
                  {restos.length} líneas quedaron fuera (no tenían marca)
                </summary>
                <ul className="apunte" style={{ maxHeight: '14rem', overflow: 'auto' }}>
                  {restos.slice(0, 100).map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </details>
            )}

            {validado.ok && (
              <>
                <hr className="filete" />
                <label className="campo">
                  <span>Nombre del curso, si lo vas a crear nuevo</span>
                  <input
                    type="text"
                    value={nombreCurso}
                    placeholder={validado.curso ?? 'Mi curso'}
                    onChange={(e) => setNombreCurso(e.target.value)}
                  />
                </label>
                <div className="botonera-columna">
                  {curso && (
                    <button type="button" className="boton boton-fuerte boton-ancho" onClick={() => guardar(false)}>
                      Guardar en “{curso.nombre}”
                    </button>
                  )}
                  <button type="button" className="boton boton-ancho" onClick={() => guardar(true)}>
                    {cursos.length === 0 ? 'Crear el curso y guardar' : 'Guardar en un curso nuevo'}
                  </button>
                </div>
              </>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function aBrutos(items: ReturnType<typeof convertirApunte>['items']): unknown[] {
  return items.map((i) => ({
    tipo: i.tipo,
    bloque: i.bloque,
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
      >{`## Obligaciones            ← cambia el bloque
[art. 1489 CC]            ← referencia para lo que viene

F: La condición resolutoria tácita opera de pleno derecho.
J: Requiere sentencia; el 1489 da la opción de cumplimiento o resolución.
? ¿Y la ordinaria?        ← repregunta del ítem de arriba
= Esa sí opera de pleno derecho. [art. 1479]

LISTA: Requisitos del acto jurídico [art. 1445]
- capaz
- consentimiento sin vicios
- objeto lícito
- causa lícita

ART 1698: carga de la prueba
TEXTO 1545: Todo contrato legalmente celebrado es una ley para los contratantes...
TRIAJE(posturas): Refiérase a la culpa en abstracto o en concreto.
DES: Explique los elementos de la responsabilidad extracontractual
- capacidad
- hecho voluntario
- dolo o culpa
- daño
- causalidad`}</pre>
    </details>
  )
}
