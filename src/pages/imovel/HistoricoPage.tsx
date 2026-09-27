import { CalendarRange, Printer } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Badge } from '../../components/ui'
import { useDb } from '../../data/db'
import { imoveisComPropostaPendente, situacaoExibida } from '../../data/selectors'
import { formatarMoedaInteira } from '../../lib/format'
import { CabecalhoLote } from './CabecalhoLote'
import { nomeCurtoLote, useImovelDaRota } from './lote'

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export function HistoricoPage() {
  const db = useDb()
  const { imovel, naoEncontrado } = useImovelDaRota()
  const [filtroAberto, setFiltroAberto] = useState(false)
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')

  const eventos = useMemo(
    () =>
      db.historico
        .filter((e) => e.imovelId === imovel?.id)
        .filter((e) => !de || e.data.slice(0, 10) >= de)
        .filter((e) => !ate || e.data.slice(0, 10) <= ate)
        .sort((a, b) => a.data.localeCompare(b.data)),
    [db.historico, imovel?.id, de, ate],
  )

  if (!imovel) return naoEncontrado
  const situacao = situacaoExibida(imovel, imoveisComPropostaPendente(db))
  const filtrando = Boolean(de || ate)

  return (
    <>
      <CabecalhoLote
        imovel={imovel}
        secao="Histórico"
        subtitulo="Tudo o que aconteceu com este imóvel, em ordem · RF32 e RF33"
        acoes={
          <>
            <button
              type="button"
              className={`btn ${filtrando ? 'btn--suave' : 'btn--secundario'}`}
              aria-expanded={filtroAberto}
              onClick={() => setFiltroAberto((v) => !v)}
            >
              <CalendarRange size={15} /> {filtrando ? 'Período filtrado' : 'Filtrar período'}
            </button>
            <button type="button" className="btn btn--primario" onClick={() => window.print()}>
              <Printer size={15} /> Exportar PDF
            </button>
          </>
        }
      />
      <main className="conteudo pilha">
        {filtroAberto && (
          <section className="card secao nao-imprimir">
            <div className="grade">
              <label className="campo c-3">
                <span className="campo__rotulo">De</span>
                <input type="date" className="input" value={de} max={ate || undefined} onChange={(e) => setDe(e.target.value)} />
              </label>
              <label className="campo c-3">
                <span className="campo__rotulo">Até</span>
                <input type="date" className="input" value={ate} min={de || undefined} onChange={(e) => setAte(e.target.value)} />
              </label>
              <div className="c-3 grade__botao">
                <button type="button" className="btn btn--secundario" onClick={() => { setDe(''); setAte('') }} disabled={!filtrando}>
                  Limpar período
                </button>
              </div>
            </div>
          </section>
        )}

        <section className="card secao">
          <div className="secao__cabecalho">
            <h2 className="card__titulo">Imóvel</h2>
            <p className="card__subtitulo">Estado atual do lote no momento da consulta.</p>
          </div>
          <dl className="ficha ficha--6">
            <div><dt>Identificação</dt><dd>{nomeCurtoLote(imovel).replace(',', ' —')}</dd></div>
            <div><dt>Matrícula</dt><dd>{imovel.matricula || 'Pendente'}</dd></div>
            <div><dt>Loteamento</dt><dd>{imovel.loteamento || '—'}</dd></div>
            <div><dt>Situação atual</dt><dd><Badge variante={situacao.variante}>{situacao.rotulo}</Badge></dd></div>
            <div><dt>Valor de tabela</dt><dd>{imovel.valores.tabela ? formatarMoedaInteira(imovel.valores.tabela) : '—'}</dd></div>
            <div><dt>Última alteração</dt><dd>{new Date(imovel.atualizadoEm).toLocaleDateString('pt-BR')}</dd></div>
          </dl>
        </section>

        <section className="card">
          <div className="card__cabecalho">
            <div>
              <h2 className="card__titulo">Linha do tempo</h2>
              <p className="card__subtitulo">Cadastro, alterações, bloqueios, reservas, propostas, decisões e vendas.</p>
            </div>
          </div>
          {eventos.length === 0 ? (
            <p className="card__vazio">{filtrando ? 'Nenhum registro neste período.' : 'Nenhum registro ainda.'}</p>
          ) : (
            <div className="tabela-wrap">
              <table className="tabela tabela--quebra">
                <thead>
                  <tr>
                    <th>Data e hora</th>
                    <th>Tipo</th>
                    <th>O que aconteceu</th>
                    <th>Autor</th>
                    <th>Referência</th>
                    <th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {eventos.map((e) => (
                    <tr key={e.id}>
                      <td className="tabela__destaque">{dataHora(e.data)}</td>
                      <td>{e.tipo}</td>
                      <td>{e.descricao}</td>
                      <td>{e.autor}</td>
                      <td>{e.referencia ?? '—'}</td>
                      <td><Badge variante={e.situacao.variante}>{e.situacao.rotulo}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <p className="nota-regra">RF33 — o histórico é somente leitura: nenhum perfil pode editar ou apagar registros.</p>
      </main>
    </>
  )
}
