import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { AbasImovel } from '../../components/AbasImovel'
import type { Imovel } from '../../data/types'
import { nomeCurtoLote } from './lote'

interface Props {
  imovel: Imovel
  secao: string
  subtitulo: string
  acoes?: ReactNode
}

export function CabecalhoLote({ imovel, secao, subtitulo, acoes }: Props) {
  const nome = nomeCurtoLote(imovel)
  return (
    <>
      <header className="cabecalho">
        <div>
          <nav className="migalhas" aria-label="Você está em">
            <Link to="/imoveis">Imóveis</Link>
            <span aria-hidden>›</span>
            <Link to={`/imoveis/${imovel.id}`}>{nome.replace(',', ' —')}</Link>
            <span aria-hidden>›</span>
            <span>{secao}</span>
          </nav>
          <h1 className="cabecalho__titulo">
            {secao} — {nome}
          </h1>
          <p className="cabecalho__subtitulo">{subtitulo}</p>
        </div>
        {acoes && <div className="cabecalho__acoes">{acoes}</div>}
      </header>
      <AbasImovel imovelId={imovel.id} />
    </>
  )
}
