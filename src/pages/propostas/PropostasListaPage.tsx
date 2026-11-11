import { Plus, Search } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { Badge } from '../../components/ui'
import { useDb } from '../../data/db'
import { nomeLote } from '../../data/selectors'
import type { Proposta, StatusProposta } from '../../data/types'
import { formatarData, formatarMoedaInteira, normalizar } from '../../lib/format'

const SITUACOES: Record<StatusProposta, { rotulo: string; variante: string }> = {
  rascunho: { rotulo: 'Rascunho', variante: 'rascunho' },
  pendente: { rotulo: 'Em análise', variante: 'atencao' },
  aprovada: { rotulo: 'Aprovada', variante: 'normal' },
  recusada: { rotulo: 'Recusada', variante: 'critico' },
}

const ORDEM_SITUACAO: StatusProposta[] = ['pendente', 'rascunho', 'aprovada', 'recusada']

function textoDesconto(valor: number, tabela: number | null | undefined) {
  if (!tabela || valor >= tabela) return '—'
  const desconto = ((tabela - valor) / tabela) * 100
  return `−${desconto.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}

/** Lista de propostas comerciais com busca e filtro por situação. */
export function PropostasListaPage() {
  const db = useDb()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const situacao = (params.get('situacao') ?? '') as StatusProposta | ''

  const alterar = (chave: string, valor: string) => {
    const novo = new URLSearchParams(params)
    if (valor) novo.set(chave, valor)
    else novo.delete(chave)
    setParams(novo, { replace: true })
  }

  const linhas = useMemo(() => {
    const pessoas = new Map([...db.clientes, ...db.corretores, ...db.usuarios].map((p) => [p.id, p.nome]))
    const imoveis = new Map(db.imoveis.map((i) => [i.id, i]))
    return db.propostas
      .map((p: Proposta) => {
        const imovel = imoveis.get(p.imovelId)
        return {
          proposta: p,
          imovel: imovel ? `${nomeLote(imovel.endereco.lote, imovel.endereco.quadra)} · ${imovel.loteamento}` : 'Imóvel removido',
          tabela: imovel?.valores.tabela,
          cliente: pessoas.get(p.clienteId) ?? '—',
          responsavel: pessoas.get(p.corretorId) ?? '—',
        }
      })
      .sort((a, b) => b.proposta.criadaEm.localeCompare(a.proposta.criadaEm))
  }, [db.propostas, db.imoveis, db.clientes, db.corretores, db.usuarios])

  const termo = normalizar(q.trim())
  const filtradas = linhas.filter(
    (l) =>
      (!situacao || l.proposta.status === situacao) &&
      (!termo || normalizar(`${l.proposta.codigo} ${l.cliente} ${l.imovel}`).includes(termo)),
  )
  const pendentes = db.propostas.filter((p) => p.status === 'pendente').length

  return (
    <>
      <header className="cabecalho">
        <div>
          <h1 className="cabecalho__titulo">Propostas</h1>
          <p className="cabecalho__subtitulo">
            {db.propostas.length} propostas · {pendentes} aguardando análise · RF17 a RF21
          </p>
        </div>
        <div className="cabecalho__acoes">
          <Link to="/propostas/nova" className="btn btn--primario">
            <Plus size={16} aria-hidden /> Nova proposta
          </Link>
        </div>
      </header>

      <main className="conteudo">
        <section className="card">
          <div className="filtros">
            <div className="busca busca--larga">
              <Search size={15} className="busca__icone" aria-hidden />
              <input
                type="search"
                className="busca__input"
                placeholder="Código, cliente ou lote"
                aria-label="Buscar propostas"
                value={q}
                onChange={(e) => alterar('q', e.target.value)}
              />
            </div>
            <select className="input select" aria-label="Situação" value={situacao} onChange={(e) => alterar('situacao', e.target.value)}>
              <option value="">Todas as situações</option>
              {ORDEM_SITUACAO.map((s) => <option key={s} value={s}>{SITUACOES[s].rotulo}</option>)}
            </select>
          </div>

          {filtradas.length === 0 ? (
            <p className="card__vazio">Nenhuma proposta encontrada com esses filtros.</p>
          ) : (
            <div className="tabela-wrap">
              <table className="tabela tabela--clicavel">
                <thead>
                  <tr>
                    <th>Proposta</th><th>Imóvel</th><th>Cliente</th><th>Responsável</th>
                    <th>Valor</th><th>Desconto</th><th>Versão</th><th>Criada em</th><th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map(({ proposta: p, imovel, tabela, cliente, responsavel }) => (
                    <tr key={p.id} onClick={() => navigate(`/propostas/${p.id}`)}>
                      <td>
                        <Link to={`/propostas/${p.id}`} className="tabela__destaque" onClick={(e) => e.stopPropagation()}>
                          {p.codigo}
                        </Link>
                      </td>
                      <td>{imovel}</td>
                      <td>{cliente}</td>
                      <td>{responsavel}</td>
                      <td>{formatarMoedaInteira(p.valor)}</td>
                      <td>{textoDesconto(p.valor, tabela)}</td>
                      <td>
                        <Link to={`/propostas/${p.id}/versoes`} className="link" onClick={(e) => e.stopPropagation()}>
                          v{p.versao ?? 1}
                        </Link>
                      </td>
                      <td>{formatarData(p.criadaEm)}</td>
                      <td><Badge variante={SITUACOES[p.status].variante}>{SITUACOES[p.status].rotulo}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  )
}
