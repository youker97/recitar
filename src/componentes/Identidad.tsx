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
 * La Copa Libertadores.
 *
 * La hizo Alberto de Gasperi en 1959 y se forjó en la joyería Camusso, en la
 * avenida Colonial de Lima. No se parece a una copa de fútbol cualquiera, y
 * eso es justo lo que hay que dibujar:
 *
 * - El cuerpo es una ESFERA, no un cáliz.
 * - SÍ tiene asas: dos, cilíndricas, saliendo a los lados a la altura del
 *   ecuador, unidas por una banda que cruza la esfera de lado a lado. Esa
 *   silueta —una bola con orejas— es lo que la hace reconocible de lejos.
 * - Arriba, un futbolista rematando (bronce plateado).
 * - Abajo, un cuello corto, un pie en forma de trompeta y un pedestal
 *   cilíndrico alto con los escudos de todos los campeones.
 *
 * Las proporciones están medidas sobre una foto de la copa y llevadas a la
 * caja de 24: esfera de radio 2.5 centrada en 5.7, asas de 8.4 a 15.6, y el
 * pedestal ocupando el tercio de abajo.
 *
 * Se usa a 21 px en el botón del menú y a 26 px en el remate de la pantalla
 * de hoy, así que se dibujó mirándola a ESOS tamaños, ampliada. A 21 px no
 * hay figura humana que se lea: el futbolista es una silueta y lo que se
 * reconoce es la esfera con sus asas.
 *
 * Colo-Colo la levantó en 1991. Por eso está acá.
 */
export function Copa({ tamano = 24 }: { tamano?: number }) {
  const fino = tamano >= 30
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={fino ? 1.2 : 1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* El futbolista rematando. */}
      {fino ? (
        <>
          <circle cx="11.5" cy="1.5" r="0.6" fill="currentColor" stroke="none" />
          <path d="M11.5 2.2v1.2" />
          <path d="M10.4 2.6l1.1-.2 1.6.4" />
          <path d="M11.5 3.4l1 .6" />
        </>
      ) : (
        <>
          <circle cx="12" cy="1.6" r="0.85" fill="currentColor" stroke="none" />
          <path d="M12 2.7v1" />
        </>
      )}
      {/* La esfera, con la banda y las dos asas. */}
      <circle cx="12" cy="5.7" r="2.5" />
      <path d="M8.4 5.7h7.2" />
      <path d="M8.4 4.9v1.6M15.6 4.9v1.6" />
      {/* Cuello y pie de trompeta. */}
      <path d="M12 8.2v.8" />
      <path d="M11.3 9c0 2.6-.4 3.6-1.1 4.4M12.7 9c0 2.6.4 3.6 1.1 4.4" />
      <path d="M10.2 13.4h3.6" />
      {/* El pedestal con los escudos de los campeones. */}
      <path d="M8.8 14.7h6.4l-1.4-1.3h-3.6z" />
      <path d="M8.8 14.7h6.4v6.1H8.8z" />
      {fino && <path d="M8.8 16.2h6.4M8.8 17.7h6.4M8.8 19.2h6.4" opacity="0.4" />}
      <path d="M8.4 20.8h7.2v1.4H8.4z" />
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
