import { useEffect, useMemo, useState } from 'react'
import { db } from '../datos/db'
import { useCursoActivo, useFuentes, useItems } from '../datos/hooks'
import type { Fuente, Item, SeccionApunte } from '../datos/tipos'
import { partirTexto } from '../importar/claude'
import { detectarSecciones, textoDeSeccion } from '../logica/mapa'
import { conceptosDeBloque, revisarVolcado } from '../logica/conceptos'
import { contarPalabras } from '../logica/corrector'
import { contiene, normalizar } from '../logica/comparar'
import { resumenDeItem } from '../logica/resumen'
import { ir, useUbicacion } from '../rutas'

type Etapa = 'predecir' | 'leer' | 'recordar' | 'comparar'

const LARGO_TROZO = 1500

interface Paso {
  seccion: SeccionApunte
  indiceSeccion: number
  texto: string
  ultimoDeLaSeccion: boolean
}

/**
 * Primera pasada: lo único de la app donde se lee, y no se lee de corrido.
 * Por cada trozo: intentar sin saber, leer, cerrar y escribir lo que quedó.
 * Se avanza tema por tema, no cada tantas letras.
 */
export function Pasada() {
  const { params } = useUbicacion()
  const curso = useCursoActivo()
  const fuentes = useFuentes(curso?.id)
  const items = useItems(curso?.id)
  const [fuenteId, setFuenteId] = useState<string | null>(params.get('fuente'))
  const [paso, setPaso] = useState(0)
  const [etapa, setEtapa] = useState<Etapa>('predecir')
  const [prediccion, setPrediccion] = useState('')
  const [recuerdo, setRecuerdo] = useState('')

  const fuente = fuentes.find((f) => f.id === fuenteId) ?? null

  const pasos = useMemo<Paso[]>(() => {
    if (!fuente) return []
    const secciones = mapaDe(fuente)
    const tope = Number.isInteger(fuente.hasta) ? fuente.hasta : secciones.length - 1
    return secciones.slice(0, tope + 1).flatMap((seccion, indiceSeccion) => {
      const trozos = partirTexto(textoDeSeccion(fuente.texto, seccion), LARGO_TROZO)
      return trozos.map((t, i) => ({
        seccion,
        indiceSeccion,
        texto: t.texto,
        ultimoDeLaSeccion: i === trozos.length - 1,
      }))
    })
  }, [fuente])

  const actual = pasos[paso]

  const conceptos = useMemo(
    () => (fuente ? conceptosDeBloque(items.filter((i) => i.bloque === fuente.bloque)) : []),
    [items, fuente],
  )
  const delTrozo = useMemo(
    () => (actual ? conceptos.filter((c) => contiene(actual.texto, c.termino)) : []),
    [conceptos, actual],
  )
  const preguntas = useMemo(() => {
    if (!actual) return [] as Item[]
    return items
      .filter((i) => !i.padreId && delTrozo.some((c) => c.itemId === i.id))
      .slice(0, 2)
  }, [items, actual, delTrozo])

  // Al abrir un apunte se parte en la primera sección sin cubrir.
  useEffect(() => {
    if (!fuente || pasos.length === 0) return
    const primero = pasos.findIndex((p) => !p.seccion.cubierta)
    setPaso(primero === -1 ? 0 : primero)
    setEtapa('predecir')
    setPrediccion('')
    setRecuerdo('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fuenteId, pasos.length])

  async function marcarCubierta(indiceSeccion: number) {
    if (!fuente) return
    const secciones = mapaDe(fuente).map((s, i) => (i === indiceSeccion ? { ...s, cubierta: true } : s))
    await db.fuentes.put({
      ...fuente,
      secciones,
      avance: paso + 1,
      terminada: secciones.every((s) => s.cubierta),
    })
    // Los ítems de esa sección quedan disponibles para las sesiones.
    const titulo = normalizar(secciones[indiceSeccion].titulo)
    const suyos = items.filter((i) => i.seccion && normalizar(i.seccion) === titulo)
    if (suyos.length > 0) await db.items.bulkPut(suyos)
  }

  async function siguiente() {
    if (!actual) return
    if (actual.ultimoDeLaSeccion) await marcarCubierta(actual.indiceSeccion)
    setPrediccion('')
    setRecuerdo('')
    setEtapa('predecir')
    if (paso + 1 >= pasos.length) {
      ir('/')
      return
    }
    setPaso(paso + 1)
  }

  if (!curso) {
    return <div className="vacio"><p>Primero mete material.</p><a className="boton" href="#/importar">Importar</a></div>
  }

  if (!fuente) {
    return (
      <div>
        <div className="titulo-seccion"><h1>Primera pasada</h1></div>
        <p className="apunte">
          Para lo que todavía no entiendes. No es leer: por cada trozo primero intentas responder sin
          saber, después lees, y después cierras el texto y escribes lo que quedó. Equivocarse antes
          de leer hace que el texto se agarre mucho mejor.
        </p>
        {fuentes.length === 0 ? (
          <div className="vacio">
            <p>No hay apuntes guardados todavía.</p>
            <p className="apunte">Cuando importes un PDF o un apunte, el texto queda acá.</p>
            <a className="boton" href="#/importar">Importar un apunte</a>
          </div>
        ) : (
          <div className="opciones seccion">
            {fuentes.map((f) => {
              const secciones = mapaDe(f)
              const cubiertas = secciones.filter((s) => s.cubierta).length
              return (
                <button key={f.id} type="button" className="opcion" onClick={() => setFuenteId(f.id)}>
                  <span>
                    <strong>{f.titulo}</strong>
                    <small>
                      {f.bloque} · {secciones.length} temas · {cubiertas} con la pasada hecha
                    </small>
                  </span>
                </button>
              )
            })}
          </div>
        )}
        <p style={{ marginTop: '1rem' }}>
          <a className="boton boton-chico" href="#/mapa">Ver el mapa de mis apuntes</a>
        </p>
      </div>
    )
  }

  if (!actual) {
    return (
      <div className="vacio">
        <p>Este apunte ya está cubierto entero.</p>
        <a className="boton" href="#/mapa">Ver el mapa</a>
      </div>
    )
  }

  const resultado = etapa === 'comparar' ? revisarVolcado(recuerdo, delTrozo) : null

  return (
    <div>
      <div className="barra-progreso" aria-hidden="true">
        <div style={{ width: `${(paso / pasos.length) * 100}%` }} />
      </div>
      <div className="titulo-seccion">
        <h2>{actual.seccion.titulo}</h2>
        <span className="lado numeral">{paso + 1} de {pasos.length}</span>
      </div>

      {etapa === 'predecir' && (
        <>
          <h3>Antes de leer</h3>
          {preguntas.length > 0 ? (
            <>
              <p className="apunte">
                Contesta con lo que tengas. Da lo mismo si te equivocas: equivocarse ahora es lo que
                hace que después se te quede.
              </p>
              {preguntas.map((p) => (
                <p key={p.id} className="estudio">{resumenDeItem(p)}</p>
              ))}
            </>
          ) : (
            <p className="apunte">En una línea: ¿de qué crees que va este trozo?</p>
          )}
          <textarea
            className="serif"
            rows={4}
            value={prediccion}
            autoFocus
            onChange={(e) => setPrediccion(e.target.value)}
          />
          <div className="pie-fijo">
            <button
              type="button"
              className="boton boton-fuerte boton-ancho"
              disabled={contarPalabras(prediccion) < 3}
              onClick={() => setEtapa('leer')}
            >
              Ahora sí, mostrarme el texto
            </button>
          </div>
        </>
      )}

      {etapa === 'leer' && (
        <>
          <h3>Lee</h3>
          <p className="apunte">Una vez, con calma. Después vas a tener que escribirlo sin mirar.</p>
          <div className="estudio" style={{ whiteSpace: 'pre-wrap' }}>{actual.texto}</div>
          <div className="pie-fijo">
            <button type="button" className="boton boton-fuerte boton-ancho" onClick={() => setEtapa('recordar')}>
              Listo, cerrar el texto
            </button>
          </div>
        </>
      )}

      {etapa === 'recordar' && (
        <>
          <h3>Ahora sin mirar</h3>
          <p className="apunte">Escribe todo lo que quedó. Con tus palabras, en cualquier orden.</p>
          <textarea
            className="serif"
            rows={10}
            value={recuerdo}
            autoFocus
            onChange={(e) => setRecuerdo(e.target.value)}
          />
          <span className="contador">{contarPalabras(recuerdo)} palabras</span>
          <div className="pie-fijo">
            <button
              type="button"
              className="boton boton-fuerte boton-ancho"
              disabled={contarPalabras(recuerdo) < 10}
              onClick={() => setEtapa('comparar')}
            >
              Comparar con el texto
            </button>
          </div>
        </>
      )}

      {etapa === 'comparar' && resultado && (
        <>
          <h3>Qué quedó</h3>
          {resultado.total === 0 ? (
            <p className="apunte">
              Este trozo todavía no tiene conceptos asociados. Compara tú mismo con el texto.
            </p>
          ) : (
            <>
              <div className="marcador">
                <div className="marcador-cifra numeral">{resultado.cobertura}%</div>
                <div className="apunte">
                  {resultado.encontrados.length} de {resultado.total} conceptos del trozo
                </div>
              </div>
              {resultado.faltantes.length > 0 && (
                <>
                  <h3>No lo dijiste</h3>
                  <ul className="lista-limpia">
                    {resultado.faltantes.map((f, i) => (
                      <li key={i} className="renglon">
                        <span className="crece estudio" style={{ fontSize: '1rem' }}>{f.termino}</span>
                        <span className="ref">{f.ref}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}

          <details className="seccion">
            <summary className="apunte">Volver a ver el texto</summary>
            <div className="estudio" style={{ whiteSpace: 'pre-wrap' }}>{actual.texto}</div>
          </details>

          <div className="pie-fijo">
            <button type="button" className="boton boton-fuerte boton-ancho" onClick={siguiente}>
              {paso + 1 >= pasos.length
                ? 'Terminar la pasada'
                : actual.ultimoDeLaSeccion
                  ? 'Tema listo, seguir al siguiente'
                  : 'Siguiente trozo'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

/** Apuntes guardados antes del mapa: se les calcula al vuelo. */
export function mapaDe(fuente: Fuente): SeccionApunte[] {
  if (fuente.secciones?.length) return fuente.secciones
  return detectarSecciones(fuente.texto)
}
