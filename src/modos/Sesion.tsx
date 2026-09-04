import { useEffect, useMemo, useRef, useState } from 'react'
import type { Item } from '../datos/tipos'
import { db, nuevoId } from '../datos/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { useAjustes, useCursoActivo, useFuentes } from '../datos/hooks'
import { arrastrarPadre, cargarDatos, marcarMala, registrarRespuesta } from '../datos/repos'
import { armarCola } from '../logica/cola'
import { calcularAlcance, filtrarPorAlcance } from '../logica/alcance'
import { hijosDe } from '../logica/cadena'
import { useUbicacion, ir } from '../rutas'
import { formatearDuracion } from '../componentes/Cronometro'
import { ModoVF } from './ModoVF'
import { ModoAlternativas } from './ModoAlternativas'
import { ModoConcepto } from './ModoConcepto'
import { ModoLista } from './ModoLista'
import { ModoArticulo } from './ModoArticulo'
import { ModoTextoLegal } from './ModoTextoLegal'
import { ModoTriaje } from './ModoTriaje'
import { ModoDesarrollo } from './ModoDesarrollo'
import { ModoOral } from './ModoOral'
import { ModoRepregunta } from './ModoRepregunta'
import type { ResultadoModo } from './comun'

interface Cadena {
  raizId: string
  cadenaId: string
  restantes: number
  fallo: boolean
}

interface Resumen {
  vistos: number
  laTenia: number
  aMedias: number
  meFalto: number
  graves: number
  desde: number
}

const RESUMEN_CERO: Resumen = { vistos: 0, laTenia: 0, aMedias: 0, meFalto: 0, graves: 0, desde: Date.now() }

export function Sesion() {
  const { params } = useUbicacion()
  const ajustes = useAjustes()
  const curso = useCursoActivo()
  // Sin valor por defecto: así se distingue "todavía cargando" de "no hay nada".
  const todos_ = useLiveQuery(() => cargarDatos(curso?.id), [curso?.id])
  const fuentes = useFuentes(curso?.id)

  const soloErrores = params.get('errores') === '1'
  const oral = params.get('oral') === '1'
  const bloqueFiltro = params.get('bloque') ?? undefined
  const soloEstos = (params.get('items') ?? '').split(',').filter(Boolean)

  // Una lista explícita de ítems (por ejemplo la de un volcado) manda sobre el
  // alcance: si se pidieron esos, son esos.
  const datos = useMemo(() => {
    if (!todos_) return undefined
    if (soloEstos.length > 0) return todos_
    return filtrarPorAlcance(todos_, calcularAlcance(fuentes)).dentro
  }, [todos_, fuentes, soloEstos.length])
  const limite = Number(params.get('limite')) || undefined

  const [arrancada, setArrancada] = useState(false)
  const [actual, setActual] = useState<Item | null>(null)
  const [terminada, setTerminada] = useState(false)
  const [resumen, setResumen] = useState<Resumen>(RESUMEN_CERO)
  const [aviso, setAviso] = useState<string | null>(null)
  const [enCadena, setEnCadena] = useState(false)
  const [restanFuera, setRestanFuera] = useState(0)
  const [reclamando, setReclamando] = useState(false)

  const pendientes = useRef<Item[]>([])
  const cadena = useRef<Cadena | null>(null)
  const todos = useRef<Item[]>([])
  const vueltas = useRef<Map<string, number>>(new Map())
  const direcciones = useRef<Map<string, 'numeroAMateria' | 'materiaANumero'>>(new Map())
  const bloques = useMemo(
    () => [...new Set((datos ?? []).map((d) => d.item.bloque).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')),
    [datos],
  )

  // La cola se arma una sola vez: si se rearmara con cada respuesta, los
  // ítems recién contestados volverían a aparecer a mitad de sesión.
  useEffect(() => {
    if (arrancada || !datos || datos.length === 0) return
    const cola = armarCola(datos, {
      soloErrores,
      soloEstos,
      bloques: bloqueFiltro ? [bloqueFiltro] : undefined,
      cadenaActiva: ajustes.cadenaActiva,
      nuevosPorDia: ajustes.nuevosPorDia,
      limite,
    })
    todos.current = datos.map((d) => d.item)
    vueltas.current = new Map(datos.map((d) => [d.item.id, d.progreso.totalRepasos]))
    let k = 0
    for (const { item } of cola) {
      if (item.tipo === 'articulo') {
        direcciones.current.set(item.id, k % 2 === 0 ? 'numeroAMateria' : 'materiaANumero')
        k++
      }
    }
    pendientes.current = cola.map((c) => c.item)
    setRestanFuera(pendientes.current.length)
    setResumen({ ...RESUMEN_CERO, desde: Date.now() })
    setArrancada(true)
    avanzar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datos, arrancada])

  function avanzar() {
    setReclamando(false)
    const siguiente = pendientes.current.shift() ?? null
    const dentroDeCadena = cadena.current != null
    setActual(siguiente)
    setEnCadena(dentroDeCadena)
    // Dentro de una cadena no se actualiza el contador: no hay que delatar
    // cuántas repreguntas vienen.
    if (!dentroDeCadena) setRestanFuera(pendientes.current.length)
    if (!siguiente) setTerminada(true)
  }

  async function alResponder(r: ResultadoModo) {
    const item = actual!
    const c = cadena.current

    await registrarRespuesta({
      item,
      modo: r.modo,
      confianza: r.confianza,
      nota: r.nota,
      duracionMs: r.duracionMs,
      respuesta: r.respuesta,
      aciertos: r.aciertos,
      total: r.total,
      cadenaId: c?.cadenaId,
    })

    setResumen((prev) => ({
      ...prev,
      vistos: prev.vistos + 1,
      laTenia: prev.laTenia + (r.nota === 'laTenia' ? 1 : 0),
      aMedias: prev.aMedias + (r.nota === 'aMedias' ? 1 : 0),
      meFalto: prev.meFalto + (r.nota === 'meFalto' ? 1 : 0),
      graves: prev.graves + (r.confianza === 'seguro' && r.nota === 'meFalto' ? 1 : 0),
    }))

    let mensaje: string | null = null

    if (c) {
      c.restantes -= 1
      if (r.nota !== 'laTenia') c.fallo = true
    }

    const hijos = ajustes.cadenaActiva ? hijosDe(todos.current, item.id) : []
    if (hijos.length > 0) {
      if (c) {
        c.restantes += hijos.length
      } else {
        cadena.current = { raizId: item.id, cadenaId: nuevoId('cad'), restantes: hijos.length, fallo: false }
      }
      pendientes.current.unshift(...hijos)
    } else if (c && c.restantes <= 0) {
      if (c.fallo) {
        await arrastrarPadre(c.raizId, c.cadenaId)
        mensaje = 'Caíste en una repregunta. El ítem de arriba tampoco cuenta como sabido.'
      } else {
        mensaje = 'Aguantaste toda la cadena.'
      }
      cadena.current = null
    }

    setAviso(mensaje)
    avanzar()
  }

  async function guardarGrabacion(blob: Blob, ms: number) {
    if (!actual) return
    await db.grabaciones.put({
      id: nuevoId('g'),
      itemId: actual.id,
      fecha: Date.now(),
      duracionMs: ms,
      blob,
    })
  }

  if (!curso) {
    return (
      <div className="vacio">
        <p>Primero crea un curso y mete material.</p>
        <a className="boton" href="#/material">Ir al material</a>
      </div>
    )
  }

  if (terminada || (arrancada && !actual)) {
    const minutos = Math.round((Date.now() - resumen.desde) / 60000)
    return (
      <div>
        <div className="titulo-seccion">
          <h2>Sesión terminada</h2>
          <span className="lado">{minutos} min</span>
        </div>
        {resumen.vistos === 0 ? (
          <div className="vacio">
            <p>No hay nada pendiente ahora mismo.</p>
            <p className="apunte">
              La repetición espaciada tiene sus tiempos: volver antes no sirve de mucho.
            </p>
          </div>
        ) : (
          <>
            <div className="cifras seccion">
              <div><span className="cifra">{resumen.laTenia}</span><span>la tenía</span></div>
              <div><span className="cifra">{resumen.aMedias}</span><span>a medias</span></div>
              <div><span className="cifra">{resumen.meFalto}</span><span>me faltó</span></div>
              <div><span className="cifra rojo">{resumen.graves}</span><span>graves</span></div>
            </div>
            {resumen.graves > 0 && (
              <div className="hoja hoja-alerta">
                <strong>{resumen.graves} de esos los diste por sabidos.</strong>
                <p style={{ margin: '0.3rem 0 0' }}>
                  Quedan arriba en el registro de errores y vuelven pronto.
                </p>
              </div>
            )}
          </>
        )}
        <div className="botonera-columna seccion">
          <button
            type="button"
            className="boton boton-fuerte"
            onClick={() => {
              cadena.current = null
              pendientes.current = []
              setAviso(null)
              setArrancada(false)
              setTerminada(false)
              setActual(null)
            }}
          >
            Otra vuelta
          </button>
          <button type="button" className="boton" onClick={() => ir('/')}>Volver al inicio</button>
        </div>
      </div>
    )
  }

  if (datos && datos.length === 0) {
    // Tener el apunte cargado no es lo mismo que tener preguntas: hay que
    // decirlo, o parece que la importación no hizo nada.
    const hayApuntes = fuentes.length > 0
    return (
      <div className="vacio">
        {hayApuntes ? (
          <>
            <p>Tienes apuntes cargados, pero todavía no hay preguntas que repasar.</p>
            <p className="apunte">
              Parte por el vocabulario de un tema, dale la primera pasada, o pídele a Claude las
              preguntas de ese tema desde el mapa.
            </p>
            <div className="botonera-columna">
              <a className="boton boton-fuerte" href="#/vocabulario">Vocabulario de un tema</a>
              <a className="boton" href="#/pasada">Primera pasada</a>
              <a className="boton" href="#/mapa">Ver el mapa</a>
            </div>
          </>
        ) : (
          <>
            <p>Este curso no tiene material todavía.</p>
            <a className="boton boton-fuerte" href="#/importar">Meter material</a>
          </>
        )}
      </div>
    )
  }

  if (!actual) return <p className="apunte">Armando la sesión…</p>

  const propsComunes = {
    item: actual,
    ajustes,
    onListo: alResponder,
    bloques,
    enCadena,
    vuelta: vueltas.current.get(actual.id) ?? 0,
  }

  const clave = `${actual.id}-${resumen.vistos}`
  let cuerpo
  switch (actual.tipo) {
    case 'concepto': cuerpo = <ModoConcepto key={clave} {...propsComunes} />; break
    case 'vf': cuerpo = <ModoVF key={clave} {...propsComunes} />; break
    case 'alternativas': cuerpo = <ModoAlternativas key={clave} {...propsComunes} />; break
    case 'lista': cuerpo = <ModoLista key={clave} {...propsComunes} />; break
    case 'articulo':
      cuerpo = (
        <ModoArticulo
          key={clave}
          {...propsComunes}
          direccion={direcciones.current.get(actual.id) ?? 'numeroAMateria'}
        />
      )
      break
    case 'textoLegal': cuerpo = <ModoTextoLegal key={clave} {...propsComunes} />; break
    case 'triaje': cuerpo = <ModoTriaje key={clave} {...propsComunes} />; break
    case 'desarrollo':
      cuerpo = oral
        ? <ModoOral key={clave} {...propsComunes} onGrabacion={guardarGrabacion} />
        : <ModoDesarrollo key={clave} {...propsComunes} />
      break
    case 'repregunta':
      cuerpo = ajustes.repreguntasHabladas
        ? <ModoOral key={clave} {...propsComunes} onGrabacion={guardarGrabacion} />
        : <ModoRepregunta key={clave} {...propsComunes} />
      break
    default: cuerpo = <p>Tipo de ítem desconocido.</p>
  }

  const totalVisible = resumen.vistos + restanFuera + 1

  return (
    <div>
      {!enCadena && (
        <div className="barra-progreso" aria-hidden="true">
          <div style={{ width: `${Math.min(100, (resumen.vistos / Math.max(1, totalVisible)) * 100)}%` }} />
        </div>
      )}
      {enCadena && (
        <p className="apunte" style={{ marginTop: '0.75rem' }}>
          Sigue raspando…
        </p>
      )}
      {aviso && <div className="hoja hoja-aviso">{aviso}</div>}
      {cuerpo}
      <hr className="filete" />

      {/* La verificación que sirve de verdad: la que haces cuando tienes la
          respuesta delante y te suena mal. Un toque y queda apartada. */}
      {reclamando ? (
        <div className="hoja">
          <strong>¿Qué tiene de malo?</strong>
          <p className="apunte" style={{ margin: '0.3rem 0 0.6rem' }}>
            Se aparta de las sesiones y queda en “Para revisar”, con lo que digas.
          </p>
          <div className="botonera-columna">
            {[
              'La respuesta está equivocada.',
              'No es lo que dice el apunte.',
              'La pregunta está mal planteada o no se entiende.',
              'Está repetida.',
            ].map((motivo) => (
              <button
                key={motivo}
                type="button"
                className="boton boton-chico"
                onClick={async () => {
                  await marcarMala(actual.id, motivo)
                  setReclamando(false)
                  setAviso('Apartada. Queda en “Para revisar”.')
                  avanzar()
                }}
              >
                {motivo}
              </button>
            ))}
            <button type="button" className="boton boton-chico boton-plano" onClick={() => setReclamando(false)}>
              Mejor no
            </button>
          </div>
        </div>
      ) : (
        <p>
          <button type="button" className="boton boton-chico boton-plano" onClick={() => setReclamando(true)}>
            Esta pregunta está mala
          </button>
        </p>
      )}

      <p className="apunte numeral">
        {resumen.vistos} respondidos · {formatearDuracion(Date.now() - resumen.desde)}
      </p>
    </div>
  )
}
