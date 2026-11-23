import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'

import { useDb } from '../../data/db'
import type { Imovel } from '../../data/types'

/** "Lote 12, Qd. 04" — forma curta usada nos títulos das páginas do lote. */
export function nomeCurtoLote(i: Imovel) {
  if (!i.endereco.lote) return i.titulo || 'Imóvel'
  return i.endereco.quadra ? `Lote ${i.endereco.lote}, Qd. ${i.endereco.quadra}` : `Lote ${i.endereco.lote}`
}

/** Carrega o imóvel da rota; devolve null e a tela de "não encontrado". */
export function useImovelDaRota(): { imovel: Imovel | undefined; naoEncontrado: ReactNode } {
  const { id } = useParams()
  const db = useDb()
  const imovel = db.imoveis.find((i) => i.id === id)
  return {
    imovel,
    naoEncontrado: (
      <main className="conteudo">
        <section className="card vazio">
          <h2>Imóvel não encontrado</h2>
          <p>Ele pode ter sido excluído.</p>
          <Link to="/imoveis" className="btn btn--secundario">
            Voltar para imóveis
          </Link>
        </section>
      </main>
    ),
  }
}
