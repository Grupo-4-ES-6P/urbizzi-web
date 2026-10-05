import { ExternalLink } from 'lucide-react'
import type { MouseEvent } from 'react'

// Recorte exibido: ~600 m x 270 m, suficiente para enxergar o lote dentro da quadra.
const LARGURA = 1000
const ALTURA = 400
const SPAN_LNG = 0.006
const SPAN_LAT = 0.0024

interface MapaLoteProps {
  lat: number | null
  lng: number | null
  /** Onde centralizar quando ainda não há coordenada (ex.: centro do loteamento). */
  centroPadrao: { lat: number; lng: number }
  rotulo: string
  marcando: boolean
  onMarcar: (lat: number, lng: number) => void
}

const arred = (v: number) => Math.round(v * 1e6) / 1e6

/**
 * Mapa esquemático do loteamento. O recorte é fixo em "células" de coordenada,
 * então clicar converte a posição em latitude/longitude reais dentro dele.
 */
export function MapaLote({ lat, lng, centroPadrao, rotulo, marcando, onMarcar }: Readonly<MapaLoteProps>) {
  const temPonto = lat !== null && lng !== null
  const base = temPonto ? { lat, lng } : centroPadrao
  const centro = {
    lat: Math.round(base.lat / SPAN_LAT) * SPAN_LAT,
    lng: Math.round(base.lng / SPAN_LNG) * SPAN_LNG,
  }
  const oeste = centro.lng - SPAN_LNG / 2
  const norte = centro.lat + SPAN_LAT / 2

  const x = temPonto ? ((lng - oeste) / SPAN_LNG) * LARGURA : 0
  const y = temPonto ? ((norte - lat) / SPAN_LAT) * ALTURA : 0

  const clicar = (e: MouseEvent<SVGSVGElement>) => {
    if (!marcando) return
    const r = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * LARGURA
    const py = ((e.clientY - r.top) / r.height) * ALTURA
    onMarcar(arred(norte - (py / ALTURA) * SPAN_LAT), arred(oeste + (px / LARGURA) * SPAN_LNG))
  }

  let legenda = <span>Informe as coordenadas ou use “Marcar no mapa”.</span>
  if (marcando) {
    legenda = <span>Clique no mapa para posicionar o lote.</span>
  } else if (temPonto) {
    legenda = (
      <a
        className="link"
        href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
        target="_blank"
        rel="noreferrer"
      >
        Conferir no Google Maps <ExternalLink size={12} />
      </a>
    )
  }

  return (
    <div className={`mapa ${marcando ? 'mapa--marcando' : ''}`}>
      <svg
        viewBox={`0 0 ${LARGURA} ${ALTURA}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={temPonto ? `Lote marcado em ${lat}, ${lng}` : 'Nenhum ponto marcado'}
        onClick={clicar}
      >
        <rect width={LARGURA} height={ALTURA} className="mapa__fundo" />
        {/* Divisas de quadras */}
        {Array.from({ length: 9 }, (_, i) => (
          <line key={`v${i}`} x1={i * 125 + 20} y1="0" x2={i * 125 + 20} y2={ALTURA} className="mapa__divisa" />
        ))}
        {Array.from({ length: 4 }, (_, i) => (
          <line key={`h${i}`} x1="0" y1={i * 110 + 30} x2={LARGURA} y2={i * 110 + 30} className="mapa__divisa" />
        ))}
        {/* Vias */}
        <line x1="0" y1="120" x2={LARGURA} y2="250" className="mapa__via" />
        <line x1="420" y1="0" x2="420" y2={ALTURA} className="mapa__via" />
        <line x1="0" y1="345" x2={LARGURA} y2="345" className="mapa__via mapa__via--local" />

        {temPonto && (
          <g transform={`translate(${x} ${y})`}>
            <rect x="-48" y="-30" width="96" height="60" className="mapa__lote" />
            <circle r="7" className="mapa__pino" />
            <text y="-40" textAnchor="middle" className="mapa__rotulo">
              {rotulo}
            </text>
          </g>
        )}
      </svg>
      <div className="mapa__legenda">
        {legenda}
      </div>
    </div>
  )
}
