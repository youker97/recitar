import { useEffect, useMemo, useState } from 'react'
import { db } from '../datos/db'
import { useCursoActivo, useFuentes, useItems } from '../datos/hooks'
import type { Fuente, Item } from '../datos/tipos'
import { partirTexto } from '../importar/claude'
import { conceptosDeBloque, revisarVolcado } from '../logica/conceptos'
import { contarPalabras } from '../logica/corrector'
import { contiene } from '../logica/comparar'
import { resumenDeItem } from '../logica/resumen'
import { ir } from '../rutas'

type Etapa = 'predecir' | 'leer' | 'recordar' | 'comparar'

const LARGO_TROZO = 1500

/**
 * Primera pasada: la única parte de la app donde se lee.
 *
 * El orden importa. Primero se intenta responder sin saber (eso se llama
 * pretesting: equivocarse antes de leer hace que el texto se agarre mejor
 * después). Después se lee. Y después se cierra y se escribe lo que quedó,
 * que es donde de verdad se aprende.
 */
export function Pasada() {
  const curso = useCursoActivo()
  const fuentes = useFuentes(curso?.id)
  const items = useItems(curso?.id)
  const [fuenteId, setFuenteId] = useState<string | null>(null)
  const [indice, setIndice] = useState(0)
  const [etapa, setEtapa] = useState<Etapa>('predecir')
  const [prediccion, setPrediccion] = useState('')
  const [recuerdo, setRecuerdo] = useState('')

  const fuente = fuentes.find((f) => f.id === fuenteId) ?? null
  const trozos = useMemo(
    () => (fuente ? partirTexto(fuente.texto, LARGO_TROZO) : []),
    [fuente],
  )
  const trozo = trozos[indice]

  const conceptos = useMemo(
    () => (fuente ? conceptosDeBloque(items.filter((i) => i.bloque === fuente.bloque)) : []),
    [items, fuente],
  )

  // Los conceptos que de verdad están en este trozo: contra esos se compara.
  const delTrozo = useMemo(
    () => (trozo ? conceptos.filter((c) => contiene(trozo.texto, c.termino)) : []),
    [conceptos, trozo],
  )

  // Preguntas de antes: ítems cuyo contenido aparece en este trozo.
  const preguntas = useMemo(() => {
    if (!trozo) return [] as Item[]
    const candidatos = items.filter(
      (i) => !i.padreId && i.bloque === fuente?.bloque && delTrozo.some((c) => c.itemId === i.id),
    )
    return candidatos.slice(0, 2)
  }, [items, trozo, fuente, delTrozo])

  useEffect(() => {
    if (!fuente) return
    if (fuente.avance > 0 && indice === 0) setIndice(Math.min(fuente.avance, trozos.length - 1))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fuenteId])

  async function guardarAvance(nuevo: number, terminada = false) {
    if (!fuente) return
    await db.fuentes.put({ ...fuente, avance: nuevo, terminada })
  }

  function siguienteTrozo() {
    const nuevo = indice + 1
    setPrediccion('')
    setRecuerdo('')
    setEtapa('predecir')
    if (nuevo >= trozos.length) {
      guardarAvance(trozos.length, true)
      setFuenteId(null)
      setIndice(0)
      ir('/')
      return
    }
    setIndice(nuevo)
    guardarAvance(nuevo)
  }

  if (!curso) {
    return <div className="vacio"><p>Primero mete material.</p><a className="boton" href="#/importar">Importar</a></div>
  }

  // ---------- elegir apunte ----------
  if (!fuente) {
    return (
      <div>
        <div className="titulo-seccion"><h1>Primera pasada</h1></div>
        <p className="apunte">
          Para lo que todavía no entiendes. No es leer: por cada trozo del apunte primero intentas
          responder sin saber, después lees, y después cierras y escribes lo que quedó. Equivocarse
          antes de leer hace que el texto se agarre mucho mejor.
        </p>
        {fuentes.length === 0 ? (
          <div className="vacio">
            <p>No hay apuntes guardados todavía.</p>
            <p className="apunte">
              Cuando importes un PDF o un apunte, el texto queda guardado acá para poder darle esta
              pasada.
            </p>
            <a className="boton" href="#/importar">Importar un apunte</a>
          </div>
        ) : (
          <div className="opciones seccion">
            {fuentes.map((f) => (
              <BotonFuente key={f.id} fuente={f} onElegir={() => { setFuenteId(f.id); setIndice(0); setEtapa('predecir') }} />
            ))}
          </div>
        )}
      </div>
    )
  }

  const resultado = etapa === 'comparar' ? revisarVolcado(recuerdo, delTrozo) : null

  return (
    <div>
      <div className="barra-progreso" aria-hidden="true">
        <div style={{ width: `${(indice / trozos.length) * 100}%` }} />
      </div>
      <div className="titulo-seccion">
        <h2>{fuente.bloque}</h2>
        <span className="lado numeral">Trozo {indice + 1} de {trozos.length}</span>
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
          <div className="estudio" style={{ whiteSpace: 'pre-wrap' }}>{trozo.texto}</div>
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
          <p className="apunte">
            Escribe todo lo que quedó de ese trozo. Con tus palabras, en cualquier orden.
          </p>
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
              Este trozo todavía no tiene conceptos asociados. Compara tú mismo con el texto de
              arriba.
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
            <div className="estudio" style={{ whiteSpace: 'pre-wrap' }}>{trozo.texto}</div>
          </details>

          <div className="pie-fijo">
            <button type="button" className="boton boton-fuerte boton-ancho" onClick={siguienteTrozo}>
              {indice + 1 >= trozos.length ? 'Terminar la pasada' : 'Siguiente trozo'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function BotonFuente({ fuente, onElegir }: { fuente: Fuente; onElegir: () => void }) {
  const trozos = Math.max(1, Math.ceil(fuente.texto.length / LARGO_TROZO))
  return (
    <button type="button" className="opcion" onClick={onElegir}>
      <span>
        <strong>{fuente.titulo}</strong>
        <small>
          {fuente.bloque} · {trozos} trozos
          {fuente.terminada
            ? ' · pasada terminada'
            : fuente.avance > 0
              ? ` · vas en el ${fuente.avance + 1}`
              : ''}
        </small>
      </span>
    </button>
  )
}
