import { Link } from 'react-router-dom'

export type TomKpi = 'positivo' | 'alerta' | 'negativo' | 'neutro' | 'destaque'

interface KpiProps {
  titulo: string
  valor: number | string
  detalhe: string
  tom: TomKpi
  /** Com destino, o card inteiro vira link; sem ele, é só informativo. */
  para?: string
}

export function Kpi({ titulo, valor, detalhe, tom, para }: Readonly<KpiProps>) {
  const conteudo = (
    <>
      <span className="kpi__titulo">{titulo}</span>
      <strong className="kpi__valor">{valor}</strong>
      <span className={`kpi__detalhe kpi__detalhe--${tom}`}>{detalhe}</span>
    </>
  )
  return para ? (
    <Link to={para} className="card kpi">
      {conteudo}
    </Link>
  ) : (
    <div className="card kpi kpi--estatico">{conteudo}</div>
  )
}
