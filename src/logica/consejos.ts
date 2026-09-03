// El entrenador: consejos a partir de lo que realmente pasó, no frases sueltas.
// Todo se calcula con los datos locales; no se llama a nada externo.

import type { Ajustes, Item, Revision } from '../datos/tipos'
import type { ItemConProgreso } from './cola'
import type { EstadoEvaluacion } from './plan'

export type Tono = 'alerta' | 'aviso' | 'bien'

export interface Consejo {
  id: string
  tono: Tono
  titulo: string
  texto: string
  /** Acción sugerida, si la hay. */
  accion?: { etiqueta: string; ruta: string }
}

const DIA = 24 * 60 * 60 * 1000

export interface EntradaConsejos {
  datos: ItemConProgreso[]
  items: Item[]
  revisiones: Revision[]
  estados: EstadoEvaluacion[]
  ajustes: Ajustes
  ahora?: number
}

export function generarConsejos(entrada: EntradaConsejos): Consejo[] {
  const ahora = entrada.ahora ?? Date.now()
  const { datos, items, revisiones, estados, ajustes } = entrada
  const consejos: Consejo[] = []

  const graves = datos.filter((d) => d.progreso.enErrores && d.progreso.fallosGraves > 0)
  const enErrores = datos.filter((d) => d.progreso.enErrores)

  if (graves.length > 0) {
    consejos.push({
      id: 'graves',
      tono: 'alerta',
      titulo: `${graves.length} ${graves.length === 1 ? 'error grave' : 'errores graves'}`,
      texto:
        'Son los que fallaste estando seguro. En la prueba los habrías afirmado igual. Parte el día por ahí.',
      accion: { etiqueta: 'Estudiar solo mis errores', ruta: '#/estudiar?errores=1' },
    })
  }

  // Concentración de fallos por bloque.
  const fallosPorBloque = new Map<string, number>()
  for (const d of enErrores) {
    fallosPorBloque.set(d.item.bloque, (fallosPorBloque.get(d.item.bloque) ?? 0) + 1)
  }
  const peor = [...fallosPorBloque.entries()].sort((a, b) => b[1] - a[1])[0]
  if (peor && enErrores.length >= 5 && peor[1] / enErrores.length >= 0.4) {
    consejos.push({
      id: 'bloque-caido',
      tono: 'aviso',
      titulo: `El problema está en ${peor[0]}`,
      texto: `${peor[1]} de tus ${enErrores.length} ítems fallados son de ese bloque. No es mala memoria general: es un bloque que no entendiste. Vuelve a la fuente antes de seguir repitiendo tarjetas.`,
    })
  }

  // Ítems que se resisten: reformular en vez de repetir.
  const tercos = datos
    .filter((d) => d.progreso.totalFallos >= 3 && d.progreso.enErrores)
    .sort((a, b) => b.progreso.totalFallos - a.progreso.totalFallos)
  if (tercos.length > 0) {
    consejos.push({
      id: 'tercos',
      tono: 'aviso',
      titulo: `${tercos.length} ${tercos.length === 1 ? 'ítem se te resiste' : 'ítems se te resisten'}`,
      texto:
        'Repetir el mismo ítem por cuarta vez no funciona. Ábrelo en el editor y pártelo en dos más chicos, o reescríbelo con tus palabras: casi siempre el problema es que la pregunta pide demasiado de una vez.',
      accion: { etiqueta: 'Ver el registro de errores', ruta: '#/errores' },
    })
  }

  // Repreguntas sin usar.
  const conHijos = new Set(items.filter((i) => i.padreId).map((i) => i.padreId!))
  if (!ajustes.cadenaActiva && conHijos.size > 0) {
    consejos.push({
      id: 'cadena-apagada',
      tono: 'aviso',
      titulo: 'Tienes el modo cadena apagado',
      texto: `Hay ${conHijos.size} ítems con repreguntas encadenadas que no se están usando. El oral se pierde justo ahí: en la segunda pregunta, no en la primera.`,
      accion: { etiqueta: 'Encenderlo', ruta: '#/ajustes' },
    })
  }

  // Acertar adivinando no es saber.
  const ultimas = revisiones.filter((r) => ahora - r.fecha < 14 * DIA)
  const adivinadas = ultimas.filter((r) => r.confianza === 'adivinando' && r.nota === 'laTenia')
  if (ultimas.length >= 20 && adivinadas.length / ultimas.length > 0.2) {
    consejos.push({
      id: 'adivinando',
      tono: 'aviso',
      titulo: 'Estás acertando a la suerte',
      texto: `${Math.round((adivinadas.length / ultimas.length) * 100)}% de tus aciertos los marcaste como adivinados. Eso no es saber: es reconocer. En el oral no hay alternativas que reconocer.`,
    })
  }

  // Seguridad mal calibrada.
  const seguras = ultimas.filter((r) => r.confianza === 'seguro')
  const segurasFalladas = seguras.filter((r) => r.nota !== 'laTenia')
  if (seguras.length >= 10 && segurasFalladas.length / seguras.length > 0.25) {
    consejos.push({
      id: 'calibracion',
      tono: 'alerta',
      titulo: 'Tu seguridad no está calibrada',
      texto: `De cada 4 veces que dijiste "seguro", fallaste más de una. Antes de responder, dite en voz alta la respuesta completa: si titubeas, no estás seguro.`,
    })
  }

  // Días sin estudiar.
  const ultima = revisiones.reduce((m, r) => Math.max(m, r.fecha), 0)
  if (ultima > 0) {
    const dias = Math.floor((ahora - ultima) / DIA)
    if (dias >= 3) {
      consejos.push({
        id: 'ausencia',
        tono: 'alerta',
        titulo: `${dias} días sin estudiar`,
        texto:
          'Se acumuló material vencido. No intentes ponerte al día de una: haz la sesión de hoy completa y mañana otra. Recuperar de a poco funciona; una maratón no.',
      })
    }
  }

  // Evaluaciones apretadas.
  for (const e of estados) {
    if (e.diasRestantes <= 14 && e.pendientes > 0) {
      consejos.push({
        id: `prueba-${e.evaluacion.id}`,
        tono: e.apretado ? 'alerta' : 'aviso',
        titulo:
          e.diasRestantes === 0
            ? `${e.evaluacion.nombre} es hoy`
            : `Quedan ${e.diasRestantes} días para ${e.evaluacion.nombre}`,
        texto: e.apretado
          ? `Te faltan ${e.pendientes} ítems por dominar: son ${e.porDia} al día. Es mucho. O recortas bloques o empiezas hoy con el doble.`
          : `Te faltan ${e.pendientes} por dominar: ${e.porDia} al día y llegas sin apuro.`,
      })
    }
  }

  // Poco material oral para una prueba oral.
  for (const e of estados) {
    if (e.evaluacion.tipo === 'escrita') continue
    const orales = items.filter(
      (i) =>
        i.cursoId === e.evaluacion.cursoId &&
        (e.evaluacion.bloques.length === 0 || e.evaluacion.bloques.includes(i.bloque)) &&
        (i.tipo === 'desarrollo' || i.tipo === 'repregunta'),
    )
    if (orales.length < 5) {
      consejos.push({
        id: `oral-flaco-${e.evaluacion.id}`,
        tono: 'aviso',
        titulo: `${e.evaluacion.nombre} es oral y casi no tienes material oral`,
        texto:
          'Verdadero y falso no entrena hablar. Necesitas enunciados de desarrollo con pauta y repreguntas colgando de ellos. Pásale tus apuntes a Claude desde la pantalla de importar y pídele repreguntas.',
        accion: { etiqueta: 'Preparar material con Claude', ruta: '#/importar' },
      })
      break
    }
  }

  if (consejos.length === 0) {
    consejos.push({
      id: 'al-dia',
      tono: 'bien',
      titulo: 'Vas al día',
      texto:
        'No hay errores pendientes ni pruebas encima. Aprovecha de agregar repreguntas a los ítems que ya dominas: es lo que se cae en el oral.',
    })
  }

  return consejos
}
