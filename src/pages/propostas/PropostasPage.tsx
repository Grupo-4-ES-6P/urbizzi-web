import { Plus, Search } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { Badge } from '../../components/ui'
import { useAuth } from '../../contexts/AuthContext'
import { useDb } from '../../data/db'
import type { SituacaoProposta } from '../../data/types'
import { formatarMoedaInteira, normalizar } from '../../lib/format'
import { podeDecidirProposta } from '../../lib/permissoes'
import { emAndamento, SITUACAO_PROPOSTA } from '../../lib/propostas'
import { formatarData } from '../../lib/reservas'
import { useAgora } from '../../lib/useAgora'
import { usePermissao } from '../../lib/usePermissao'
import { montarLinhas, type LinhaProposta } from './proposta'

type Filtro = 'todas' | 'andamento' | 'minhas' | 'rascunhos' | 'aprovadas' | 'recusadas' | 'expiradas'

const FILTROS: { valor: Filtro; rotulo: string }[] = [
  { valor: 'todas', rotulo: 'Todas' },
  { valor: 'andamento', rotulo: 'Em andamento' },
  { valor: 'minhas', rotulo: 'Aguardando você' },
  { valor: 'rascunhos', rotulo: 'Rascunhos' },
  { valor: 'aprovadas', rotulo: 'Aprovadas' },
  { valor: 'recusadas', rotulo: 'Recusadas' },
  { valor: 'expiradas', rotulo: 'Expiradas' },
]

const ehFiltro = (v: string | null): v is Filtro => FILTROS.some((f) => f.valor === v)

/** Em andamento primeiro (as que expiram antes no topo); depois as demais, das mais recentes. */
function ordenar(a: LinhaProposta, b: LinhaProposta) {
  const ga = emAndamento(a.situacao) ? 0 : 1
  const gb = emAndamento(b.situacao) ? 0 : 1
  if (ga !== gb) return ga - gb
  if (ga === 0) return (a.proposta.expiraEm ?? '').localeCompare(b.proposta.expiraEm ?? '')
  return b.proposta.atualizadaEm.localeCompare(a.proposta.atualizadaEm)
}

const SITUACOES_FILTRO: Partial<Record<Filtro, SituacaoProposta>> = {
  rascunhos: 'rascunho',
  aprovadas: 'aprovada',
  recusadas: 'recusada',
  expiradas: 'expirada',
}

export function PropostasPage() {
  const db = useDb()
  const agora = useAgora()
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const podeCriar = usePermissao('criar_proposta')
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const filtroParam = params.get('situacao')
  const filtro: Filtro = ehFiltro(filtroParam) ? filtroParam : 'todas'

  const alterar = (chave: string, valor: string) => {
    const novo = new URLSearchParams(params)
    if (valor) novo.set(chave, valor)
    else novo.delete(chave)
    setParams(novo, { replace: true })
  }

  const linhas = useMemo(() => montarLinhas(db, db.propostas, agora).sort(ordenar), [db, agora])
  const corresponde = (l: LinhaProposta, f: Filtro) => {
    if (f === 'todas') return true
    if (f === 'andamento') return emAndamento(l.situacao)
    if (f === 'minhas') return podeDecidirProposta(l.proposta, usuario, agora, db.permissoes)
    return l.situacao === SITUACOES_FILTRO[f]
  }
  const termo = normalizar(q.trim())
  const buscadas = termo
    ? linhas.filter((l) => normalizar(`${l.proposta.codigo} ${l.imovelRotulo} ${l.clienteNome} ${l.corretorNome}`).includes(termo))
    : linhas
  const filtradas = buscadas.filter((l) => corresponde(l, filtro))
  const andamento = linhas.filter((l) => emAndamento(l.situacao)).length

  return (
    <>
      <header className="cabecalho">
        <div>
          <h1 className="cabecalho__titulo">Propostas</h1>
          <p className="cabecalho__subtitulo">
            {andamento} em andamento · toda proposta nasce de uma reserva ativa e passa pelo fluxo de aprovação
          </p>
        </div>
        <div className="cabecalho__acoes">
          {podeCriar && (
            <Link to="/propostas/nova" className="btn btn--primario">
              <Plus size={16} aria-hidden /> Nova proposta
            </Link>
          )}
        </div>
      </header>

      <main className="conteudo pilha">
        <section className="card">
          <div className="filtros">
            <div className="busca busca--larga">
              <Search size={15} className="busca__icone" aria-hidden />
              <input
                type="search"
                className="busca__input"
                placeholder="Código, imóvel, cliente ou corretor"
                aria-label="Buscar propostas"
                value={q}
                onChange={(e) => alterar('q', e.target.value)}
              />
            </div>
            <div className="segmentos" role="group" aria-label="Filtrar propostas por situação">
              {FILTROS.map((f) => (
                <button
                  key={f.valor}
                  type="button"
                  className="segmentos__item"
                  aria-pressed={f.valor === filtro}
                  onClick={() => alterar('situacao', f.valor === 'todas' ? '' : f.valor)}
                >
                  {f.rotulo}
                  <span className="segmentos__contagem">{buscadas.filter((l) => corresponde(l, f.valor)).length}</span>
                </button>
              ))}
            </div>
          </div>

          {filtradas.length === 0 ? (
            <p className="card__vazio">
              {linhas.length === 0
                ? 'Nenhuma proposta cadastrada ainda. Gere uma a partir de uma reserva ativa.'
                : termo
                  ? `Nenhuma proposta encontrada para "${q.trim()}".`
                  : 'Nenhuma proposta nesta situação.'}
            </p>
          ) : (
            <div className="tabela-wrap">
              <table className="tabela tabela--clicavel">
                <thead>
                  <tr>
                    <th>Proposta</th>
                    <th>Imóvel</th>
                    <th>Cliente</th>
                    <th>Valor proposto</th>
                    <th>Situação</th>
                    <th>Validade</th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map((l) => {
                    const s = SITUACAO_PROPOSTA[l.situacao]
                    return (
                      <tr key={l.proposta.id} onClick={() => navigate(`/propostas/${l.proposta.id}`)}>
                        <td>
                          <Link
                            to={`/propostas/${l.proposta.id}`}
                            className="tabela__destaque"
                            aria-label={`Detalhes da proposta ${l.proposta.codigo}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {l.proposta.codigo}
                          </Link>
                          <span className="texto-fraco"> · v{l.versao.numero}</span>
                        </td>
                        <td className="tabela__destaque">{l.imovelRotulo}</td>
                        <td>{l.clienteNome}</td>
                        <td>{formatarMoedaInteira(l.calculo.valorProposto)}</td>
                        <td>
                          <Badge variante={s.variante}>{s.rotulo}</Badge>
                        </td>
                        <td>
                          {l.proposta.expiraEm && l.situacao !== 'aprovada' && l.situacao !== 'recusada' ? (
                            <time dateTime={l.proposta.expiraEm} className={l.situacao === 'expirada' ? 'texto-fraco' : undefined}>
                              {l.situacao === 'expirada' ? 'Expirou em ' : 'Até '}
                              {formatarData(l.proposta.expiraEm)}
                            </time>
                          ) : l.proposta.decididaEm ? (
                            `Decidida em ${formatarData(l.proposta.decididaEm)}`
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  )
}
