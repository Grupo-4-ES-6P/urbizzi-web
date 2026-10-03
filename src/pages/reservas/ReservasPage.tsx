import { Download, Plus, Search, TriangleAlert } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { Badge } from '../../components/ui'
import { useDb } from '../../data/db'
import type { SituacaoReserva } from '../../data/types'
import { baixarCsv, gerarCsv } from '../../lib/csv'
import { formatarTempoRestante, normalizar } from '../../lib/format'
import {
  correspondeAoFiltro,
  FILTROS_RESERVA,
  formatarData,
  LIMITE_A_VENCER_HORAS,
  SITUACAO_RESERVA,
  type FiltroReservas,
} from '../../lib/reservas'
import { useAgora } from '../../lib/useAgora'
import { montarLinhas, type LinhaReserva } from './reserva'

/** Ativas primeiro (as que vencem antes no topo); depois expiradas, canceladas e convertidas, das mais recentes. */
const ORDEM: Record<SituacaoReserva, number> = { critico: 0, atencao: 0, ativa: 0, expirada: 1, cancelada: 2, convertida: 3 }

function ordenar(a: LinhaReserva, b: LinhaReserva) {
  const porSituacao = ORDEM[a.situacao] - ORDEM[b.situacao]
  if (porSituacao !== 0) return porSituacao
  if (ORDEM[a.situacao] === 0) return a.restante - b.restante
  return b.reserva.expiraEm.localeCompare(a.reserva.expiraEm)
}

const ehFiltro = (v: string | null): v is FiltroReservas => FILTROS_RESERVA.some((f) => f.valor === v)

export function ReservasPage() {
  const db = useDb()
  const agora = useAgora()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const situacaoParam = params.get('situacao')
  const filtro: FiltroReservas = ehFiltro(situacaoParam) ? situacaoParam : 'todas'

  const alterar = (chave: string, valor: string) => {
    const novo = new URLSearchParams(params)
    if (valor) novo.set(chave, valor)
    else novo.delete(chave)
    setParams(novo, { replace: true })
  }

  const linhas = useMemo(() => montarLinhas(db, db.reservas, agora).sort(ordenar), [db, agora])
  const termo = normalizar(q.trim())
  const buscadas = termo
    ? linhas.filter((l) =>
        normalizar(`${l.reserva.codigo} ${l.corretorNome} ${l.imovelRotulo} ${l.clienteNome}`).includes(termo),
      )
    : linhas
  const filtradas = buscadas.filter((l) => correspondeAoFiltro(l.situacao, filtro))
  // O alerta considera todas as reservas, independente da busca.
  const aVencer = linhas.filter((l) => correspondeAoFiltro(l.situacao, 'a_vencer')).length
  const ativas = linhas.filter((l) => correspondeAoFiltro(l.situacao, 'ativas')).length

  const exportar = () => {
    const csv = gerarCsv(
      ['Reserva', 'Imóvel', 'Cliente', 'Corretor', 'Criada em', 'Expira em', 'Tempo restante', 'Status'],
      filtradas.map((l) => [
        l.reserva.codigo,
        l.imovelRotulo,
        l.clienteNome,
        l.corretorNome,
        formatarData(l.reserva.dataInicio),
        formatarData(l.reserva.expiraEm),
        correspondeAoFiltro(l.situacao, 'ativas') ? formatarTempoRestante(l.restante) : '',
        SITUACAO_RESERVA[l.situacao].rotulo,
      ]),
    )
    baixarCsv('reservas.csv', csv)
  }

  return (
    <>
      <header className="cabecalho">
        <div>
          <h1 className="cabecalho__titulo">Reservas</h1>
          <p className="cabecalho__subtitulo">
            {ativas} ativas · reservas expiram automaticamente ao fim do prazo e o imóvel volta ao catálogo
          </p>
        </div>
        <div className="cabecalho__acoes">
          <button type="button" className="btn btn--secundario" onClick={exportar} disabled={filtradas.length === 0}>
            <Download size={15} /> Exportar CSV
          </button>
          <Link to="/reservas/nova" className="btn btn--primario">
            <Plus size={16} /> Nova reserva
          </Link>
        </div>
      </header>

      <main className="conteudo pilha">
        {aVencer > 0 && (
          <div className="faixa-alerta" role="status">
            <TriangleAlert size={18} aria-hidden />
            <div>
              <strong>
                {aVencer === 1
                  ? `1 reserva vence nas próximas ${LIMITE_A_VENCER_HORAS} horas`
                  : `${aVencer} reservas vencem nas próximas ${LIMITE_A_VENCER_HORAS} horas`}
              </strong>
              <p>Sem proposta registrada, o imóvel volta ao catálogo automaticamente.</p>
            </div>
            <button type="button" className="btn btn--primario btn--pequeno" onClick={() => alterar('situacao', 'a_vencer')}>
              Ver reservas críticas
            </button>
          </div>
        )}

        <section className="card">
          <div className="filtros">
            <div className="busca busca--larga">
              <Search size={15} className="busca__icone" aria-hidden />
              <input
                type="search"
                className="busca__input"
                placeholder="Código, corretor, imóvel ou cliente"
                aria-label="Buscar reservas"
                value={q}
                onChange={(e) => alterar('q', e.target.value)}
              />
            </div>
            <div className="segmentos" role="group" aria-label="Filtrar reservas por situação">
              {FILTROS_RESERVA.map((f) => {
                const ativo = f.valor === filtro
                const total = buscadas.filter((l) => correspondeAoFiltro(l.situacao, f.valor)).length
                return (
                  <button
                    key={f.valor}
                    type="button"
                    className="segmentos__item"
                    aria-pressed={ativo}
                    onClick={() => alterar('situacao', f.valor === 'todas' ? '' : f.valor)}
                  >
                    {f.rotulo}
                    <span className="segmentos__contagem">{total}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {filtradas.length === 0 ? (
            <p className="card__vazio">
              {linhas.length === 0
                ? 'Nenhuma reserva cadastrada ainda.'
                : termo
                  ? `Nenhuma reserva encontrada para "${q.trim()}".`
                  : 'Nenhuma reserva nesta situação.'}
            </p>
          ) : (
            <div className="tabela-wrap">
              <table className="tabela tabela--clicavel">
                <thead>
                  <tr>
                    <th>Reserva</th>
                    <th>Imóvel</th>
                    <th>Cliente</th>
                    <th>Corretor</th>
                    <th>Criada em</th>
                    <th>Expira em</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map((l) => {
                    const s = SITUACAO_RESERVA[l.situacao]
                    const ativa = correspondeAoFiltro(l.situacao, 'ativas')
                    return (
                      <tr key={l.reserva.id} onClick={() => navigate(`/reservas/${l.reserva.id}`)}>
                        <td>
                          <Link
                            to={`/reservas/${l.reserva.id}`}
                            className="tabela__destaque"
                            aria-label={`Detalhes da reserva ${l.reserva.codigo}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {l.reserva.codigo}
                          </Link>
                        </td>
                        <td className="tabela__destaque">{l.imovelRotulo}</td>
                        <td>{l.clienteNome}</td>
                        <td>{l.corretorNome}</td>
                        <td>{formatarData(l.reserva.dataInicio)}</td>
                        <td>
                          {ativa ? (
                            <time
                              dateTime={l.reserva.expiraEm}
                              title={new Date(l.reserva.expiraEm).toLocaleString('pt-BR')}
                              className={l.situacao === 'critico' ? 'texto-critico' : undefined}
                            >
                              {formatarTempoRestante(l.restante)}
                            </time>
                          ) : (
                            formatarData(l.reserva.expiraEm)
                          )}
                        </td>
                        <td>
                          <Badge variante={s.variante}>{s.rotulo}</Badge>
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
