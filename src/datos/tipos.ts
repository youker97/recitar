// Modelo de datos de Recitar. Todo en español, sin abreviaturas raras.

export type TipoItem =
  | 'vf'
  | 'alternativas'
  | 'lista'
  | 'articulo'
  | 'textoLegal'
  | 'triaje'
  | 'desarrollo'
  | 'repregunta'

export const TIPOS_ITEM: TipoItem[] = [
  'vf', 'alternativas', 'lista', 'articulo', 'textoLegal', 'triaje', 'desarrollo', 'repregunta',
]

export const NOMBRE_TIPO: Record<TipoItem, string> = {
  vf: 'Verdadero o falso',
  alternativas: 'Alternativas',
  lista: 'Lista contada',
  articulo: 'Artículo',
  textoLegal: 'Texto legal con huecos',
  triaje: 'Triaje',
  desarrollo: 'Desarrollo',
  repregunta: 'Repregunta',
}

export type Verbo = 'definir' | 'posturas' | 'importancia' | 'distinciones'

export const NOMBRE_VERBO: Record<Verbo, string> = {
  definir: 'Definir',
  posturas: 'Exponer posturas',
  importancia: 'Explicar importancia',
  distinciones: 'Hacer distinciones',
}

export interface DatosVF {
  pregunta: string
  esVerdadera: boolean
  justificacion: string
  /**
   * Términos que tienen que aparecer en una justificación bien dada. Sirven
   * para que la app corrija sola, sin internet. Si no vienen, se deducen de
   * la justificación correcta.
   */
  claves?: string[]
}

export interface DatosAlternativas {
  pregunta: string
  opciones: string[]
  /** Índice de la opción correcta dentro de "opciones". */
  correcta: number
  explicacion: string
}

/**
 * Un punto de la pauta de desarrollo. "claves" son los términos que la app
 * busca en la respuesta escrita para corregir sola.
 */
export interface PuntoPauta {
  texto: string
  claves?: string[]
}

export interface DatosLista {
  titulo: string
  articulo?: string
  elementos: string[]
  /** Si es true, se exige el orden de los elementos. Por defecto no importa. */
  ordenImporta?: boolean
}

export interface DatosArticulo {
  numero: string
  materia: string
  cuerpo?: string
}

export interface DatosTextoLegal {
  numero: string
  /** El texto literal. Se puede forzar un hueco escribiendo {{palabra}}. */
  textoLiteral: string
}

export interface DatosTriaje {
  enunciado: string
  bloque: string
  verbo: Verbo
}

export interface DatosDesarrollo {
  enunciado: string
  /** Se acepta texto pelado (formato antiguo) o punto con claves. */
  checklist: (string | PuntoPauta)[]
  minutosSugeridos?: number
}

export interface DatosRepregunta {
  pregunta: string
  respuesta: string
}

export type DatosItem =
  | DatosVF | DatosAlternativas | DatosLista | DatosArticulo | DatosTextoLegal
  | DatosTriaje | DatosDesarrollo | DatosRepregunta

export type OrigenItem = 'manual' | 'json' | 'md' | 'txt' | 'pdf' | 'ejemplo'

export interface Item {
  id: string
  cursoId: string
  /** El tema grande: "Antijuridicidad", "Obligaciones". */
  bloque: string
  /** El subtema dentro del apunte: "Causales de justificación". */
  seccion?: string
  tipo: TipoItem
  datos: DatosItem
  ref: string
  /** Si cuelga de otro ítem, este es el padre (modo cadena). */
  padreId?: string
  /** Orden entre hermanos de la cadena. */
  orden?: number
  etiquetas?: string[]
  suspendido?: boolean
  origen: OrigenItem
  creadoEn: number
  actualizadoEn: number
}

export type EstadoProgreso = 'nuevo' | 'aprendiendo' | 'repaso' | 'reaprendiendo'

export interface Progreso {
  itemId: string
  cursoId: string
  bloque: string
  tipo: TipoItem
  estado: EstadoProgreso
  /** Timestamp en que vuelve a tocar. */
  vence: number
  // FSRS
  estabilidad: number
  dificultad: number
  intervaloDias: number
  transcurridoDias: number
  // Leitner
  caja: number
  repeticiones: number
  lapsos: number
  ultimoRepaso?: number
  /** Aciertos consecutivos "la tenía". A los 3, sale del registro de errores. */
  aciertosSeguidos: number
  totalRepasos: number
  totalFallos: number
  fallosGraves: number
  enErrores: boolean
  ultimoFallo?: number
  /** Ítems marcados como error grave vuelven dentro de la misma sesión. */
  urgente?: boolean
}

export type Confianza = 'seguro' | 'masOMenos' | 'adivinando'
export type Nota = 'laTenia' | 'aMedias' | 'meFalto'

export const NOMBRE_CONFIANZA: Record<Confianza, string> = {
  seguro: 'Seguro',
  masOMenos: 'Más o menos',
  adivinando: 'Adivinando',
}

export const NOMBRE_NOTA: Record<Nota, string> = {
  laTenia: 'La tenía',
  aMedias: 'A medias',
  meFalto: 'Me faltó',
}

export type ModoEstudio =
  | 'vf' | 'alternativas' | 'lista' | 'articuloNumeroMateria' | 'articuloMateriaNumero'
  | 'textoLegal' | 'triaje' | 'desarrolloPapel' | 'desarrolloTecleado' | 'oral'

export interface Revision {
  id?: number
  itemId: string
  cursoId: string
  bloque: string
  tipo: TipoItem
  fecha: number
  modo: ModoEstudio
  confianza: Confianza
  nota: Nota
  /** Dije "seguro" y me faltó. */
  grave: boolean
  /** El padre cayó porque falló una repregunta. */
  arrastre?: boolean
  duracionMs: number
  respuesta?: string
  aciertos?: number
  total?: number
  cadenaId?: string
}

export interface Curso {
  id: string
  nombre: string
  sigla?: string
  creadoEn: number
  actualizadoEn: number
}

export type TipoEvaluacion = 'escrita' | 'oral' | 'ambas'

export interface Evaluacion {
  id: string
  cursoId: string
  nombre: string
  /** Fecha en formato AAAA-MM-DD, sin hora, para no pelear con zonas horarias. */
  fecha: string
  bloques: string[]
  tipo: TipoEvaluacion
}

export interface Grabacion {
  id: string
  itemId: string
  fecha: number
  duracionMs: number
  blob: Blob
}

/**
 * El texto original de un apunte, guardado para poder darle la primera pasada
 * (leer con preguntas antes y volcado después) y no solo estudiar las fichas.
 */
/** Un tramo del apunte: su título y dónde empieza y termina en el texto. */
export interface SeccionApunte {
  titulo: string
  inicio: number
  fin: number
  /** Ya le diste la primera pasada. */
  cubierta: boolean
}

export interface Fuente {
  id: string
  cursoId: string
  bloque: string
  titulo: string
  texto: string
  creadoEn: number
  /** El mapa del apunte. */
  secciones: SeccionApunte[]
  /**
   * Hasta qué sección llegó la materia del curso. Lo que viene después existe
   * en el archivo pero todavía no es tuyo: no entra a las sesiones.
   */
  hasta: number
  /** Hasta qué trozo llegó la primera pasada (compatibilidad). */
  avance: number
  terminada: boolean
}

/** Un volcado: escribir de memoria todo lo que queda de un bloque. */
export interface Volcado {
  id: string
  cursoId: string
  bloque: string
  fecha: number
  texto: string
  encontrados: number
  total: number
  duracionMs: number
  /** Ítems cuyos conceptos no salieron. */
  faltantes: string[]
}

export type Motor = 'fsrs' | 'leitner'

export interface Ajustes {
  id: 'unico'
  motor: Motor
  cadenaActiva: boolean
  varianteDesarrollo: 'papel' | 'tecleado'
  grabarOral: boolean
  /** Cuántos ítems al día cuentan para mantener la racha. */
  metaDiaria: number
  nuevosPorDia: number
  tamanoTexto: 'normal' | 'grande'
  cursoActivoId?: string
  mostrarConsejos: boolean
  /** Las repreguntas se responden hablando (como en el oral) o tecleando. */
  repreguntasHabladas: boolean
  /** La primera pasada va por trozos chicos en vez de por tema completo. */
  pasadaProfunda: boolean
}

export const AJUSTES_POR_DEFECTO: Ajustes = {
  id: 'unico',
  motor: 'fsrs',
  cadenaActiva: true,
  varianteDesarrollo: 'papel',
  grabarOral: true,
  metaDiaria: 15,
  nuevosPorDia: 20,
  tamanoTexto: 'normal',
  mostrarConsejos: true,
  repreguntasHabladas: true,
  pasadaProfunda: false,
}
