import { useMemo, useState } from 'react'
import { db, nuevoId } from '../datos/db'
import { useCursoActivo, useFuentes, useItems } from '../datos/hooks'
import { conceptosDeBloque, conceptosDeTexto, revisarVolcado, type Concepto } from '../logica/conceptos'
import { contarPalabras } from '../logica/corrector'
import { Cronometro, useCronometro } from '../componentes/Cronometro'
import { ir, useUbicacion } from '../rutas'

type Paso = 'elegir' | 'escribiendo' | 'informe'

/**
 * Volcado (free recall): hoja en blanco y escribir todo lo que queda de un
 * bloque. Es la prueba más honesta de si entendiste: no hay pregunta que te
 * dé la mitad de la respuesta.
 */
export function Volcado() {
  const { params } = useUbicacion()
  const curso = useCursoActivo()
  const items = useItems(curso?.id)
  const fuentes = useFuentes(curso?.id)
  const [bloque, setBloque] = useState(params.get('bloque') ?? '')
  const [paso, setPaso] = useState<Paso>(params.get('bloque') ? 'escribiendo' : 'elegir')
  const [texto, setTexto] = useState('')
  const reloj = useCronometro(false)

  // Las materias salen de las preguntas y también de los apuntes: se puede
  // hacer un volcado apenas se importa el texto, sin haber generado nada.
  const bloques = useMemo(
    () => [...new Set([
      ...items.map((i) => i.bloque),
      ...fuentes.map((f) => f.bloque),
    ].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')),
    [items, fuentes],
  )

  const conceptosDe = useMemo(
    () => (b: string): Concepto[] => {
      const delMaterial = conceptosDeBloque(items.filter((i) => i.bloque === b))
      if (delMaterial.length > 0) return delMaterial
      return fuentes
        .filter((f) => f.bloque === b)
        .flatMap((f) => conceptosDeTexto(f.texto, b, f.titulo))
    },
    [items, fuentes],
  )

  const conceptos = useMemo(() => conceptosDe(bloque), [conceptosDe, bloque])

  const resultado = useMemo(
    () => (paso === 'informe' ? revisarVolcado(texto, conceptos) : null),
    [paso, texto, conceptos],
  )

  async function terminar() {
    reloj.detener()
    const r = revisarVolcado(texto, conceptos)
    await db.volcados.put({
      id: nuevoId('v'),
      cursoId: curso!.id,
      bloque,
      fecha: Date.now(),
      texto,
      encontrados: r.encontrados.length,
      total: r.total,
      duracionMs: reloj.ms,
      faltantes: [...new Set(r.faltantes.map((f) => f.itemId))],
    })
    setPaso('informe')
  }

  if (!curso) {
    return <div className="vacio"><p>Primero mete material.</p><a className="boton" href="#/importar">Importar</a></div>
  }

  if (paso === 'elegir') {
    return (
      <div>
        <div className="titulo-seccion"><h1>Volcado</h1></div>
        <p className="apunte">
          Hoja en blanco: escribes todo lo que te acuerdas de una materia, sin mirar nada y sin que
          nadie te pregunte. Después la app te dice qué conceptos salieron y cuáles no aparecieron
          nunca. Es la medida más honesta de si entendiste: una tarjeta siempre te da la mitad de la
          respuesta, la hoja en blanco no te da nada.
        </p>
        {bloques.length === 0 ? (
          <div className="vacio"><p>No hay materias todavía.</p></div>
        ) : (
          <div className="opciones seccion">
            {bloques.map((b) => {
              const cuantos = conceptosDe(b).length
              return (
                <button
                  key={b}
                  type="button"
                  className="opcion"
                  onClick={() => { setBloque(b); setPaso('escribiendo'); reloj.reiniciar(); reloj.arrancar() }}
                >
                  <span>
                    <strong>{b}</strong>
                    <small>{cuantos} conceptos que deberías poder escribir de memoria</small>
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  if (paso === 'escribiendo') {
    const palabras = contarPalabras(texto)
    return (
      <div>
        <div className="titulo-seccion">
          <h2>{bloque}</h2>
          <span className="lado numeral">{palabras} palabras</span>
        </div>
        <p className="apunte">
          Todo lo que te acuerdes: instituciones, requisitos, artículos, excepciones, distinciones.
          En cualquier orden. No mires nada.
        </p>
        <div className="seccion"><Cronometro ms={reloj.ms} /></div>
        <textarea
          className="serif"
          rows={16}
          value={texto}
          autoFocus
          placeholder="Escribe sin parar. Cuando creas que no queda nada, quédate diez segundos más: casi siempre sale algo."
          onChange={(e) => setTexto(e.target.value)}
        />
        <div className="pie-fijo">
          <button
            type="button"
            className="boton boton-fuerte boton-ancho"
            disabled={palabras < 20}
            onClick={terminar}
          >
            Ya no me acuerdo de más
          </button>
          {palabras < 20 && (
            <p className="apunte centrado" style={{ marginTop: '0.4rem' }}>
              Sigue: recién llevas {palabras} palabras.
            </p>
          )}
        </div>
      </div>
    )
  }

  const r = resultado!
  const porItem = new Map<string, Concepto[]>()
  for (const f of r.faltantes) {
    const lista = porItem.get(f.itemId) ?? []
    lista.push(f)
    porItem.set(f.itemId, lista)
  }
  const idsFaltantes = [...porItem.keys()]

  return (
    <div>
      <div className="titulo-seccion">
        <h1>Lo que produjiste</h1>
        <span className="lado numeral">{Math.round(reloj.ms / 60000)} min</span>
      </div>

      <div className="marcador">
        <div className="marcador-cifra numeral">{r.cobertura}%</div>
        <div className="apunte">{r.encontrados.length} de {r.total} conceptos del bloque</div>
      </div>

      <div className="hoja">
        {r.cobertura >= 75
          ? 'Eso es tener la materia. Lo que falta ya es afinar.'
          : r.cobertura >= 45
            ? 'Tienes la mitad. Lo que no salió no es que se te haya olvidado: nunca llegó a entrar.'
            : 'Todavía no está. No sirve repetir tarjetas: vuelve al apunte de esta materia y dale una primera pasada.'}
      </div>

      {r.faltantes.length > 0 && (
        <section className="seccion">
          <div className="titulo-seccion">
            <h2>No apareció nada de esto</h2>
            <span className="lado numeral">{r.faltantes.length}</span>
          </div>
          <ul className="lista-limpia">
            {r.faltantes.slice(0, 40).map((f, i) => (
              <li key={i} className="renglon">
                <span className="crece estudio" style={{ fontSize: '1rem' }}>{f.termino}</span>
                <span className="ref">{f.ref}</span>
              </li>
            ))}
          </ul>
          {r.faltantes.length > 40 && <p className="apunte">…y {r.faltantes.length - 40} más.</p>}
        </section>
      )}

      {r.encontrados.length > 0 && (
        <details className="seccion">
          <summary className="apunte">Lo que sí produjiste ({r.encontrados.length})</summary>
          <ul className="lista-limpia">
            {r.encontrados.map((f, i) => (
              <li key={i} className="renglon">
                <span className="crece verde">{f.termino}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="botonera-columna seccion">
        {idsFaltantes.length > 0 && (
          <button
            type="button"
            className="boton boton-fuerte"
            onClick={() => ir(`/estudiar?items=${idsFaltantes.slice(0, 60).join(',')}`)}
          >
            Estudiar los {idsFaltantes.length} que no salieron
          </button>
        )}
        <button type="button" className="boton" onClick={() => { setTexto(''); setPaso('elegir') }}>
          Otro volcado
        </button>
      </div>
    </div>
  )
}
