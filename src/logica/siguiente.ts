// La próxima jugada: una sola cosa que hacer ahora.
//
// La regla que la hace distinta de una lista de tareas: puede decirte que NO
// avances. Si el tema anterior quedó a medias, seguir agregando materia nueva
// solo acumula temas a medias.

import type { Ajustes, Fuente, Volcado } from '../datos/tipos'
import type { ItemConProgreso } from './cola'
import { contarPendientes } from './cola'
import { dominioDe } from './dominio'
import { normalizar } from './comparar'

export interface Jugada {
  clave: string
  titulo: string
  texto: string
  etiqueta: string
  ruta: string
  /** true cuando la jugada es frenar, no avanzar. */
  freno?: boolean
}

const DIA = 24 * 60 * 60 * 1000
const DOMINIO_FLOJO = 45
const VOLCADO_FLOJO = 45

export interface EntradaJugada {
  datos: ItemConProgreso[]
  fuentes: Fuente[]
  volcados: Volcado[]
  ajustes: Ajustes
  ahora?: number
}

export function proximaJugada(entrada: EntradaJugada): Jugada {
  const ahora = entrada.ahora ?? Date.now()
  const { datos, fuentes, volcados } = entrada
  const cuentas = contarPendientes(datos, ahora)

  // 1. Los errores graves mandan sobre todo lo demás.
  if (cuentas.graves >= 3) {
    return {
      clave: 'graves',
      titulo: `Parte por tus ${cuentas.graves} errores graves`,
      texto: 'Son los que fallaste estando seguro. En la prueba los habrías afirmado igual.',
      etiqueta: 'Estudiar mis errores',
      ruta: '#/estudiar?errores=1',
    }
  }

  // 2. Un tema recién cubierto que quedó flojo: frenar antes de avanzar.
  const cubiertas = fuentes.flatMap((f) =>
    (f.secciones ?? []).filter((s) => s.cubierta).map((s) => ({ fuente: f, seccion: s })),
  )
  for (const { fuente, seccion } of cubiertas.slice(-3).reverse()) {
    const delTema = datos.filter(
      (d) => d.item.seccion && normalizar(d.item.seccion) === normalizar(seccion.titulo),
    )
    if (delTema.length < 3) continue
    const dominio = dominioDe(delTema).porcentaje
    const ultimoVolcado = volcados
      .filter((v) => v.bloque === fuente.bloque)
      .sort((a, b) => b.fecha - a.fecha)[0]
    const volcadoFlojo =
      ultimoVolcado && ultimoVolcado.total > 0
        ? Math.round((ultimoVolcado.encontrados / ultimoVolcado.total) * 100) < VOLCADO_FLOJO
        : false
    if (dominio < DOMINIO_FLOJO || volcadoFlojo) {
      return {
        clave: `freno-${seccion.titulo}`,
        titulo: `No avances todavía: ${seccion.titulo}`,
        texto: `Ese tema va en ${dominio}%. Si sigues agregando materia nueva vas a terminar con cinco temas a medias. Termina este primero.`,
        etiqueta: 'Repasar ese tema',
        ruta: `#/estudiar?items=${delTema.slice(0, 40).map((d) => d.item.id).join(',')}`,
        freno: true,
      }
    }
  }

  // 3. Materia en alcance que todavía no tiene su primera pasada.
  for (const f of fuentes) {
    const secciones = f.secciones ?? []
    const tope = Number.isInteger(f.hasta) ? f.hasta : secciones.length - 1
    const pendiente = secciones.findIndex((s, i) => i <= tope && !s.cubierta)
    if (pendiente !== -1) {
      const s = secciones[pendiente]
      const minutos = Math.max(5, Math.round((s.fin - s.inicio) / 900))
      return {
        clave: `pasada-${f.id}-${pendiente}`,
        titulo: `Te toca: ${s.titulo}`,
        texto: `De "${f.titulo}". Unos ${minutos} minutos: primero intentas sin saber, después lees, después lo escribes de memoria.`,
        etiqueta: 'Empezar la primera pasada',
        ruta: `#/pasada?fuente=${f.id}`,
      }
    }
  }

  // 4. Repaso del día.
  if (cuentas.vencidos + cuentas.errores > 0) {
    return {
      clave: 'repaso',
      titulo: `Repasa lo de hoy: ${cuentas.vencidos + cuentas.errores} ítems`,
      texto: 'Ya cubriste la materia; esto es mantenerla. Es lo que evita volver a empezar de cero.',
      etiqueta: 'Empezar la sesión',
      ruta: '#/estudiar',
    }
  }

  // 5. Un volcado, si hace rato que no.
  const bloques = [...new Set(datos.map((d) => d.item.bloque).filter(Boolean))]
  for (const bloque of bloques) {
    const ultimo = volcados.filter((v) => v.bloque === bloque).sort((a, b) => b.fecha - a.fecha)[0]
    if (!ultimo || ahora - ultimo.fecha > 7 * DIA) {
      return {
        clave: `volcado-${bloque}`,
        titulo: `Hazte un volcado de ${bloque}`,
        texto: 'Hoja en blanco, sin preguntas que te den la mitad. Es la única forma de saber qué queda de verdad.',
        etiqueta: 'Hacer el volcado',
        ruta: `#/volcado?bloque=${encodeURIComponent(bloque)}`,
      }
    }
  }

  if (cuentas.nuevos > 0) {
    return {
      clave: 'nuevos',
      titulo: `Tienes ${cuentas.nuevos} ítems sin ver`,
      texto: 'La materia está cubierta y al día. Puedes seguir sumando de a poco.',
      etiqueta: 'Estudiar',
      ruta: '#/estudiar',
    }
  }

  return {
    clave: 'ensayo',
    titulo: 'Estás al día: rinde un ensayo',
    texto: 'No queda nada vencido. Un ensayo completo te dice si aguantas la prueba entera de corrido.',
    etiqueta: 'Rendir un ensayo',
    ruta: '#/ensayo',
  }
}
