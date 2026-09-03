import { useMemo } from 'react'
import { useCursoActivo, useDatos, useRevisiones } from '../datos/hooks'
import { estaDominado } from '../logica/plan'
import { calibracion } from '../logica/prontitud'
import { NOMBRE_CONFIANZA } from '../datos/tipos'
import { NOMBRE_TIPO, type TipoItem } from '../datos/tipos'

const DIA = 24 * 60 * 60 * 1000

export function Estadisticas() {
  const curso = useCursoActivo()
  const datos = useDatos(curso?.id)
  const revisiones = useRevisiones(curso?.id, 2000)

  const resumen = useMemo(() => {
    const dominados = datos.filter((d) => estaDominado(d.progreso)).length
    const sinVer = datos.filter((d) => d.progreso.totalRepasos === 0).length
    const enErrores = datos.filter((d) => d.progreso.enErrores).length
    return { dominados, sinVer, enErrores, total: datos.length }
  }, [datos])

  const ultimos30 = useMemo(() => {
    const desde = Date.now() - 30 * DIA
    return revisiones.filter((r) => r.fecha >= desde)
  }, [revisiones])

  const aciertos = ultimos30.filter((r) => r.nota === 'laTenia').length
  const graves = ultimos30.filter((r) => r.grave).length

  const porBloque = useMemo(() => {
    const mapa = new Map<string, { total: number; fallos: number }>()
    for (const r of ultimos30) {
      const actual = mapa.get(r.bloque) ?? { total: 0, fallos: 0 }
      actual.total++
      if (r.nota === 'meFalto') actual.fallos++
      mapa.set(r.bloque, actual)
    }
    return [...mapa.entries()]
      .map(([bloque, x]) => ({ bloque, ...x, razon: x.total ? x.fallos / x.total : 0 }))
      .sort((a, b) => b.razon - a.razon)
  }, [ultimos30])

  const porTipo = useMemo(() => {
    const mapa = new Map<TipoItem, { total: number; aciertos: number }>()
    for (const r of ultimos30) {
      const actual = mapa.get(r.tipo) ?? { total: 0, aciertos: 0 }
      actual.total++
      if (r.nota === 'laTenia') actual.aciertos++
      mapa.set(r.tipo, actual)
    }
    return [...mapa.entries()].sort((a, b) => b[1].total - a[1].total)
  }, [ultimos30])

  const calib = useMemo(() => calibracion(ultimos30), [ultimos30])

  const diasSeguidos = useMemo(() => {
    const dias = new Set(revisiones.map((r) => new Date(r.fecha).toDateString()))
    let cuenta = 0
    const cursor = new Date()
    while (dias.has(cursor.toDateString())) {
      cuenta++
      cursor.setDate(cursor.getDate() - 1)
    }
    return cuenta
  }, [revisiones])

  return (
    <div>
      <div className="titulo-seccion"><h1>Avance</h1></div>

      <div className="cifras seccion">
        <div><span className="cifra">{resumen.dominados}</span><span>dominados</span></div>
        <div><span className="cifra">{resumen.enErrores}</span><span>en errores</span></div>
        <div><span className="cifra">{resumen.sinVer}</span><span>sin ver</span></div>
        <div><span className="cifra">{resumen.total}</span><span>en total</span></div>
      </div>

      <hr className="filete" />

      <section className="seccion">
        <div className="titulo-seccion">
          <h2>Últimos 30 días</h2>
          <span className="lado numeral">{ultimos30.length} respuestas</span>
        </div>
        {ultimos30.length === 0 ? (
          <p className="apunte">Todavía no hay historial.</p>
        ) : (
          <div className="cifras">
            <div>
              <span className="cifra">{Math.round((aciertos / ultimos30.length) * 100)}%</span>
              <span>“la tenía”</span>
            </div>
            <div><span className="cifra rojo">{graves}</span><span>errores graves</span></div>
            <div><span className="cifra">{diasSeguidos}</span><span>días seguidos</span></div>
          </div>
        )}
      </section>

      {calib.intentos >= 10 && (
        <>
          <hr className="filete" />
          <section className="seccion">
            <div className="titulo-seccion">
              <h2>Qué tan bien te conoces</h2>
              <span className="lado numeral">
                {calib.exceso > 0 ? `+${calib.exceso} de más` : `${calib.exceso}`}
              </span>
            </div>
            <p className="apunte">
              Cuando dices que estás seguro, ¿aciertas? Darse cuenta de esto es lo que baja el exceso
              de confianza, que es lo que te hunde en un oral.
            </p>
            <table className="tabla">
              <thead>
                <tr><th>Dijiste</th><th>Veces</th><th>Acertaste</th></tr>
              </thead>
              <tbody>
                {calib.filas.filter((f) => f.intentos > 0).map((f) => (
                  <tr key={f.confianza}>
                    <td>{NOMBRE_CONFIANZA[f.confianza]}</td>
                    <td className="numeral">{f.intentos}</td>
                    <td className="numeral">{f.razon}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="apunte" style={{ marginTop: '0.5rem' }}>
              {calib.exceso > 15
                ? 'Te crees más de lo que sabes. Antes de decir "seguro", dite la respuesta completa en voz alta.'
                : calib.exceso < -15
                  ? 'Sabes más de lo que crees. Confía un poco más: la duda te está costando tiempo.'
                  : 'Estás bien calibrado: cuando dices que sabes, sabes.'}
            </p>
          </section>
        </>
      )}

      {porBloque.length > 0 && (
        <>
          <hr className="filete" />
          <section className="seccion">
            <h2>Dónde se cae</h2>
            <table className="tabla">
              <thead>
                <tr><th>Bloque</th><th>Respuestas</th><th>Fallos</th></tr>
              </thead>
              <tbody>
                {porBloque.map((b) => (
                  <tr key={b.bloque}>
                    <td>{b.bloque}</td>
                    <td className="numeral">{b.total}</td>
                    <td className="numeral">{b.fallos} ({Math.round(b.razon * 100)}%)</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}

      {porTipo.length > 0 && (
        <>
          <hr className="filete" />
          <section className="seccion">
            <h2>Por tipo de ejercicio</h2>
            <table className="tabla">
              <thead>
                <tr><th>Tipo</th><th>Respuestas</th><th>Acertadas</th></tr>
              </thead>
              <tbody>
                {porTipo.map(([tipo, x]) => (
                  <tr key={tipo}>
                    <td>{NOMBRE_TIPO[tipo]}</td>
                    <td className="numeral">{x.total}</td>
                    <td className="numeral">{Math.round((x.aciertos / x.total) * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  )
}
