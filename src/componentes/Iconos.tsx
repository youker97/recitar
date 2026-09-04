/**
 * Los iconos del menú. De trazo, 24×24, en currentColor: así toman el color de
 * la fila, incluida la fila activa, sin tener que dibujarlos dos veces.
 *
 * Dibujados acá y no traídos de una librería: son nueve, pesan nada, y la app
 * tiene que abrir sin señal.
 */

export type NombreIcono =
  | 'estudiar' | 'preguntas' | 'apuntes' | 'traer' | 'escribir'
  | 'progreso' | 'apartadas' | 'errores' | 'calendario' | 'ajustes'

const TRAZOS: Record<NombreIcono, JSX.Element> = {
  // Dos fichas apiladas: lo que se estudia.
  estudiar: (
    <>
      <rect x="3" y="7" width="14" height="13" rx="2.5" />
      <path d="M7 4h11a3 3 0 0 1 3 3v10" />
    </>
  ),
  // Un signo de pregunta en un globo.
  preguntas: (
    <>
      <path d="M20 15a3 3 0 0 1-3 3H9l-5 3V6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3z" />
      <path d="M9.6 8.5a2.5 2.5 0 0 1 4.8 1c0 1.7-2.4 1.9-2.4 3.4" />
      <path d="M12 15.6v.01" />
    </>
  ),
  // Una hoja escrita.
  apuntes: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h4" />
    </>
  ),
  // Una flecha entrando a una bandeja.
  traer: (
    <>
      <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
      <path d="M12 3v11" />
      <path d="M8 10l4 4 4-4" />
    </>
  ),
  escribir: (
    <>
      <path d="M4 20h4l10.5-10.5a2.5 2.5 0 0 0-3.5-3.5L4.5 16.5z" />
      <path d="M14.5 6.5l3 3" />
    </>
  ),
  // Barras: cómo voy.
  progreso: (
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </>
  ),
  // Una banderita: lo apartado.
  apartadas: (
    <>
      <path d="M5 21V4" />
      <path d="M5 5h10l-1.5 3L15 11H5z" />
    </>
  ),
  // Un aspa en un círculo: lo que fallaste.
  errores: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.2 9.2l5.6 5.6M14.8 9.2l-5.6 5.6" />
    </>
  ),
  calendario: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  ajustes: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.8v2.4M12 18.8v2.4M4.5 7.5l2 1.2M17.5 15.3l2 1.2M4.5 16.5l2-1.2M17.5 8.7l2-1.2" />
    </>
  ),
}

export function Icono({ nombre }: { nombre: NombreIcono }) {
  return (
    <svg
      className="icono"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {TRAZOS[nombre]}
    </svg>
  )
}
