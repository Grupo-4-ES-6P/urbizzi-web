import { Grid3x3, Plus, SquarePlus } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { Badge } from '../../components/ui'
import { SITUACOES_LOTEAMENTO } from '../../data/catalogos'
import { useDb } from '../../data/db'
import type { SituacaoLoteamento, VarianteBadge } from '../../data/types'

const VARIANTE_LOTEAMENTO: Record<SituacaoLoteamento, VarianteBadge> = {
  em_aprovacao: 'neutro',
  em_registro: 'atencao',
  em_comercializacao: 'normal',
  esgotado: 'escuro',
}

const rotuloSituacaoLoteamento = (s: SituacaoLoteamento) =>
  SITUACOES_LOTEAMENTO.find((x) => x.valor === s)?.rotulo ?? s

export function LoteamentosPage() {
  const db = useDb()
  const navigate = useNavigate()

  return (
    <>
      <header className="cabecalho">
        <div>
          <nav className="migalhas" aria-label="Você está em">
            <Link to="/imoveis">Imóveis</Link>
            <span aria-hidden>›</span>
            <span>Loteamentos</span>
          </nav>
          <h1 className="cabecalho__titulo">Loteamentos</h1>
          <p className="cabecalho__subtitulo">{db.loteamentos.length} empreendimentos cadastrados</p>
        </div>
        <div className="cabecalho__acoes">
          <Link to="/imoveis/loteamentos/novo" className="btn btn--primario">
            <Plus size={16} /> Novo loteamento
          </Link>
        </div>
      </header>
      <main className="conteudo">
        <section className="card">
          <div className="tabela-wrap">
            <table className="tabela tabela--clicavel">
              <thead>
                <tr>
                  <th>Loteamento</th>
                  <th>Código</th>
                  <th>Cidade</th>
                  <th>Quadras</th>
                  <th>Lotes</th>
                  <th>Disponíveis</th>
                  <th>Situação</th>
                  <th><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {db.loteamentos.map((l) => {
                  const lotes = db.imoveis.filter((i) => i.loteamento === l.nome)
                  return (
                    <tr key={l.id} onClick={() => navigate(`/imoveis/loteamentos/${l.id}`)}>
                      <td>
                        <Link to={`/imoveis/loteamentos/${l.id}`} className="tabela__destaque" onClick={(e) => e.stopPropagation()}>
                          {l.nome}
                        </Link>
                      </td>
                      <td>{l.codigo}</td>
                      <td>{l.cidade}/{l.uf}</td>
                      <td>{db.quadras.filter((q) => q.loteamento === l.nome).length}</td>
                      <td>{lotes.length}</td>
                      <td>{lotes.filter((i) => i.situacao === 'disponivel').length}</td>
                      <td><Badge variante={VARIANTE_LOTEAMENTO[l.situacao]}>{rotuloSituacaoLoteamento(l.situacao)}</Badge></td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="acoes-linha">
                          <Link to={`/imoveis/loteamentos/${l.id}/mapa`} className="btn btn--secundario btn--pequeno">
                            <Grid3x3 size={13} /> Mapa
                          </Link>
                          <Link to={`/imoveis/loteamentos/${l.id}/quadras/nova`} className="btn btn--secundario btn--pequeno">
                            <SquarePlus size={13} /> Nova quadra
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  )
}
