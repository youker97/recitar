import { useEffect, useRef, useState } from 'react'
import { formatearDuracion } from './Cronometro'

type Estado = 'inicial' | 'grabando' | 'listo' | 'sinSoporte' | 'sinPermiso'

/**
 * Grabar la respuesta hablada es opcional: si el navegador no deja, la app
 * sigue funcionando igual y solo lo avisa.
 */
export function Grabadora({ onBlob }: { onBlob?: (blob: Blob, duracionMs: number) => void }) {
  const [estado, setEstado] = useState<Estado>('inicial')
  const [url, setUrl] = useState<string | null>(null)
  const [ms, setMs] = useState(0)
  const grabador = useRef<MediaRecorder | null>(null)
  const trozos = useRef<Blob[]>([])
  const inicio = useRef(0)
  const pista = useRef<MediaStream | null>(null)

  useEffect(() => {
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setEstado('sinSoporte')
    }
    return () => {
      pista.current?.getTracks().forEach((t) => t.stop())
      if (url) URL.revokeObjectURL(url)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (estado !== 'grabando') return
    const id = window.setInterval(() => setMs(Date.now() - inicio.current), 250)
    return () => window.clearInterval(id)
  }, [estado])

  async function empezar() {
    try {
      const flujo = await navigator.mediaDevices.getUserMedia({ audio: true })
      pista.current = flujo
      const mr = new MediaRecorder(flujo)
      trozos.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) trozos.current.push(e.data) }
      mr.onstop = () => {
        const blob = new Blob(trozos.current, { type: mr.mimeType || 'audio/webm' })
        const duracion = Date.now() - inicio.current
        if (url) URL.revokeObjectURL(url)
        setUrl(URL.createObjectURL(blob))
        setEstado('listo')
        onBlob?.(blob, duracion)
        pista.current?.getTracks().forEach((t) => t.stop())
      }
      grabador.current = mr
      inicio.current = Date.now()
      setMs(0)
      mr.start()
      setEstado('grabando')
    } catch {
      setEstado('sinPermiso')
    }
  }

  function parar() {
    grabador.current?.stop()
  }

  if (estado === 'sinSoporte') {
    return <p className="apunte">Este navegador no permite grabar. Responde igual en voz alta.</p>
  }
  if (estado === 'sinPermiso') {
    return (
      <p className="apunte">
        No se pudo usar el micrófono. Responde igual en voz alta: la grabación es un extra.
      </p>
    )
  }

  return (
    <div className="seccion">
      {estado !== 'grabando' ? (
        <div className="botonera">
          <button type="button" className="boton" onClick={empezar}>
            {estado === 'listo' ? 'Grabar de nuevo' : 'Grabarme mientras respondo'}
          </button>
        </div>
      ) : (
        <div className="botonera">
          <button type="button" className="boton boton-peligro" onClick={parar}>
            Detener grabación ({formatearDuracion(ms)})
          </button>
        </div>
      )}
      {url && (
        <audio controls src={url} style={{ width: '100%', marginTop: '0.6rem' }}>
          Tu navegador no puede reproducir el audio.
        </audio>
      )}
    </div>
  )
}
