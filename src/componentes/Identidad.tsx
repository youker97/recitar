/**
 * Los adornos de la casa: blanco y negro, y el dorado de las estrellas.
 *
 * Están dibujados acá con SVG a propósito. Una foto de un jugador de verdad
 * no es mía para meterla, y además la app tiene que abrir sin señal: cualquier
 * imagen traída de internet dejaría un hueco justo cuando no hay conexión.
 * Si quieres una foto tuya, se pone en Ajustes y se guarda en el teléfono.
 */

/** El escudo por defecto: la banda de la camiseta y una estrella. */
export function Escudo({ tamano = 26 }: { tamano?: number }) {
  return (
    <svg
      className="emblema emblema-svg"
      viewBox="0 0 32 32"
      role="img"
      aria-label="Recitar"
      /* En línea porque .emblema fija el tamaño del escudo de la cinta y si no
         no habría forma de mostrarlo más grande en Ajustes. */
      style={{ width: tamano, height: tamano }}
    >
      <defs>
        <clipPath id="rec-escudo">
          <path d="M16 1.5 29 5.4v10.9c0 7-5.4 12.4-13 15.2C8.4 28.7 3 23.3 3 16.3V5.4z" />
        </clipPath>
      </defs>
      <g clipPath="url(#rec-escudo)">
        <rect x="0" y="0" width="32" height="32" fill="currentColor" opacity="0.08" />
        <path d="M-4 32 L28 0 L36 0 L4 32 Z" fill="currentColor" opacity="0.7" />
        <path d="M11 5.9l1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z" fill="#d7a442" />
      </g>
      <path
        d="M16 1.5 29 5.4v10.9c0 7-5.4 12.4-13 15.2C8.4 28.7 3 23.3 3 16.3V5.4z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        opacity="0.55"
      />
    </svg>
  )
}

function Estrella({ lado = 11 }: { lado?: number }) {
  return (
    <svg width={lado} height={lado} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.4l6.5-.9z" fill="currentColor" />
    </svg>
  )
}

/** Tres estrellas seguidas, para rematar un bloque. */
export function Estrellas({ cuantas = 3 }: { cuantas?: number }) {
  return (
    <span className="estrellas" aria-hidden="true">
      {Array.from({ length: cuantas }, (_, i) => <Estrella key={i} />)}
    </span>
  )
}

function Camiseta() {
  return (
    <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
      <path
        d="M11 4 6 6.5 4 12l3.5 1.5V28h17V13.5L28 12l-2-5.5L21 4a5 5 0 0 1-10 0z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <text
        x="16"
        y="24"
        textAnchor="middle"
        fontSize="10"
        fontWeight="700"
        fill="currentColor"
        fontFamily="var(--sans)"
      >
        14
      </text>
    </svg>
  )
}

/**
 * La Copa Libertadores. Vale la pena dibujarla como es y no una copa
 * cualquiera: la Libertadores NO tiene asas.
 *
 * La hizo Alberto de Gasperi en 1959 y se forjó en la joyería Camusso, en la
 * avenida Colonial de Lima. Es un cáliz de plata de ley, hondo y sin asas,
 * coronado por un futbolista —ese va en bronce plateado— parado sobre la
 * tapa, y montado en un pedestal de madera donde van los escudos de todos los
 * campeones.
 *
 * Colo-Colo la levantó en 1991. Por eso está acá.
 *
 * Se usa a 21 px en el botón del menú y a 26 px en el remate de la pantalla de
 * hoy. A ese tamaño no hay figura humana que se lea, así que el futbolista es
 * una silueta parada en su peana: el detalle que se nota es la silueta del
 * cáliz y el pedestal, y eso es lo que la distingue de una copa cualquiera.
 */
export function Copa({ tamano = 24 }: { tamano?: number }) {
  const fino = tamano >= 22
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={fino ? 1.4 : 1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* El futbolista, parado en la tapa. */}
      <circle cx="12" cy="2.4" r={fino ? 1 : 1.2} fill="currentColor" stroke="none" />
      <path d="M12 3.6v2" />
      <path d="M10.5 5.9h3" />
      {/* El cáliz: boca ancha, cuerpo hondo, sin asas. */}
      <path d="M6.2 6.9h11.6" />
      <path d="M7.1 6.9l.55 4.6c.28 2.35 2.1 3.6 4.35 3.6s4.07-1.25 4.35-3.6L16.9 6.9" />
      {/* Pie y pedestal con los escudos de los campeones. */}
      <path d="M12 15.1v1.9" />
      <path d="M9.6 17h4.8" />
      <path d="M7.7 17.9h8.6v4H7.7z" />
      {fino && <path d="M7.7 19.9h8.6" opacity="0.4" />}
    </svg>
  )
}

function Balon() {
  return (
    <svg width="24" height="24" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M16 8.5l4.6 3.4-1.8 5.5h-5.6l-1.8-5.5z" fill="currentColor" opacity="0.85" />
      <path d="M16 4v4.5M6.2 12.5l4.9 3.6M25.8 12.5l-4.9 3.6M10.5 27l2.7-5.5M21.5 27l-2.7-5.5"
        fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

const ADORNOS = [
  { dibujo: <Estrellas cuantas={3} />, texto: 'Las tres del 91' },
  { dibujo: <Camiseta />, texto: 'El 14' },
  { dibujo: <Copa tamano={26} />, texto: 'Campeón de América · 1991' },
  { dibujo: <Balon />, texto: 'Cacique' },
]

/**
 * Un detalle chico al pie de la pantalla de hoy. Cambia por día, así aparece
 * de vez en cuando y no cansa.
 */
export function Adorno({ semilla = Math.floor(Date.now() / 86400000) }: { semilla?: number }) {
  const { dibujo, texto } = ADORNOS[Math.abs(semilla) % ADORNOS.length]
  return (
    <div className="adorno">
      <span className="adorno-linea" />
      {dibujo}
      <span>{texto}</span>
      <span className="adorno-linea" />
    </div>
  )
}
