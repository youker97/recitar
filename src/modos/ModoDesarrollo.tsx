import { useEffect, useMemo, useState } from 'react'
import type { DatosDesarrollo } from '../datos/tipos'
import { NOMBRE_NOTA } from '../datos/tipos'
import { Cronometro, useCronometro } from '../componentes/Cronometro'
import { ElegirConfianza } from '../componentes/Confianza'
import { Autocalificacion } from '../componentes/Autocalificacion'
import { Pauta, sugerirNota } from '../componentes/Pauta'
import { CorregirConClaude } from '../componentes/CorregirConClaude'
import { contarPalabras, puntosDe, revisarRespuesta } from '../logica/corrector'
import { BotonRevelar, Encabezado, Enunciado, Referencia, useFases, type PropsModo } from './comun'

const MINIMO_PAPEL_MS = 30_000
const MINIMO_PALABRAS = 25

export function ModoDesarrollo({ item, ajustes, onListo, enCadena }: PropsModo) {
  const datos = item.datos as DatosDesarrollo
  const puntos = useMemo(() => puntosDe(datos.checklist), [datos.checklist])
  const [variante, setVariante] = useState(ajustes.varianteDesarrollo)
  const [texto, setTexto] = useState('')
  const [marcados, setMarcados] = useState<boolean[]>(() => puntos.map(() => false))
  const [revisado, setRevisado] = useState(false)
  const [comentarioClaude, setComentarioClaude] = useState<string | null>(null)
  const reloj = useCronometro(true)
  const modo = variante === 'papel' ? 'desarrolloPapel' : 'desarrolloTecleado'
  const { fase, confianza, pedirConfianza, elegirConfianza, calificar } = useFases(modo, onListo)

  useEffect(() => {
    if (fase !== 'produciendo') reloj.detener()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase])

  // Al revelar, si hay texto escrito la app corrige sola y deja la pauta
  // pre-marcada. Se puede corregir a mano: busca términos, no entiende ideas.
  useEffect(() => {
    if (fase !== 'revelado' || revisado) return
    setRevisado(true)
    if (variante === 'tecleado' && texto.trim()) {
      const revision = revisarRespuesta(texto, puntos)
      setMarcados(revision.puntos.map((p) => p.encontrado))
    }
  }, [fase, revisado, variante, texto, puntos])

  const palabras = contarPalabras(texto)
  const logrados = marcados.filter(Boolean).length
  const sugerida = sugerirNota(logrados, puntos.length)

  const puede =
    variante === 'papel' ? reloj.ms >= MINIMO_PAPEL_MS : palabras >= MINIMO_PALABRAS

  const motivo =
    variante === 'papel'
      ? 'Escribe en el cuaderno. La pauta aparece cuando lleves al menos medio minuto.'
      : `Escribe la respuesta completa: te faltan ${Math.max(0, MINIMO_PALABRAS - palabras)} palabras.`

  return (
    <div>
      <Encabezado item={item} rotulo="Desarrollo" enCadena={enCadena} />
      <Enunciado>{datos.enunciado}</Enunciado>

      {fase === 'produciendo' && (
        <>
          <div className="seccion">
            <Cronometro ms={reloj.ms} sugerido={datos.minutosSugeridos} />
          </div>

          {variante === 'papel' ? (
            <>
              <p className="apunte">
                Escribe a mano en el cuaderno. No mires nada. Cuando termines, aprieta abajo y
                aparece la pauta para tildar lo que de verdad escribiste.
              </p>
              <button type="button" className="boton boton-chico" onClick={() => setVariante('tecleado')}>
                Mejor lo tecleo (así la app me corrige sola)
              </button>
            </>
          ) : (
            <>
              <label className="campo">
                <span className="oculto-visual">Tu desarrollo</span>
                <textarea
                  className="serif"
                  rows={12}
                  value={texto}
                  autoFocus
                  onChange={(e) => setTexto(e.target.value)}
                />
                <span className="contador">{palabras} palabras</span>
              </label>
              <button type="button" className="boton boton-chico" onClick={() => setVariante('papel')}>
                Mejor lo escribo a mano
              </button>
            </>
          )}

          <BotonRevelar puede={puede} motivo={motivo} onClick={pedirConfianza} texto="Terminé" />
        </>
      )}

      {fase === 'confianza' && <ElegirConfianza onElegir={elegirConfianza} />}

      {fase === 'revelado' && (
        <>
          <hr className="filete" />
          {variante === 'tecleado' && (
            <p className="apunte">
              La app buscó en tu texto los términos de la pauta y marcó lo que encontró. Corrige lo
              que se le haya escapado: busca palabras, no entiende ideas.
            </p>
          )}
          <Pauta
            puntos={puntos.map((p) => p.texto)}
            marcados={marcados}
            onMarcar={(i, v) => {
              const copia = [...marcados]
              copia[i] = v
              setMarcados(copia)
            }}
            titulo={variante === 'tecleado' ? 'Pauta' : 'Tilda solo lo que realmente escribiste'}
          />
          <Referencia item={item} />

          {variante === 'tecleado' && (
            <CorregirConClaude
              enunciado={datos.enunciado}
              puntos={puntos.map((p) => p.texto)}
              respuesta={texto}
              referencia={item.ref}
              onCorregido={(c) => {
                const copia = [...marcados]
                for (const p of c.puntos) copia[p.indice] = p.logrado
                setMarcados(copia)
                setComentarioClaude([c.loQueFalto, c.comentario].filter(Boolean).join(' · ') || null)
              }}
            />
          )}

          {comentarioClaude && <div className="hoja hoja-aviso">{comentarioClaude}</div>}

          <p className="apunte">
            Con {logrados} de {puntos.length} tildados, esto es un “{NOMBRE_NOTA[sugerida]}”.
          </p>
          <Autocalificacion
            confianza={confianza}
            titulo="¿Cómo lo cuentas?"
            onCalificar={(n) =>
              calificar(n, {
                respuesta: variante === 'tecleado' ? texto : undefined,
                aciertos: logrados,
                total: puntos.length,
              })
            }
          />
        </>
      )}
    </div>
  )
}
