import { useEffect, useState } from 'react'

export interface Ubicacion {
  ruta: string
  params: URLSearchParams
}

export function leerUbicacion(): Ubicacion {
  const bruto = window.location.hash.replace(/^#/, '') || '/'
  const [ruta, consulta = ''] = bruto.split('?')
  return { ruta: ruta || '/', params: new URLSearchParams(consulta) }
}

export function useUbicacion(): Ubicacion {
  const [ubicacion, setUbicacion] = useState<Ubicacion>(leerUbicacion)
  useEffect(() => {
    const alCambiar = () => {
      setUbicacion(leerUbicacion())
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', alCambiar)
    return () => window.removeEventListener('hashchange', alCambiar)
  }, [])
  return ubicacion
}

export function ir(destino: string): void {
  const limpio = destino.startsWith('#') ? destino : `#${destino}`
  if (window.location.hash === limpio) {
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  } else {
    window.location.hash = limpio
  }
}
