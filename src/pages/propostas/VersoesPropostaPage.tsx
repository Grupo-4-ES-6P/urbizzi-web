import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Badge } from '../../components/ui'
import { useDb } from '../../data/db'
import { formatarMoedaInteira } from '../../lib/format'
import {
  calcularCondicoes,
  eventosDePrazo,
  EVENTOS_DE_DECISAO,
  permiteNovaVersao,
  SITUACAO_EVENTO,
  SITUACAO_PROPOSTA,
  SITUACAO_VERSAO,
  situacaoProposta,
  situacaoVersao,
  versaoAtual,
} from '../../lib/propostas'
import { formatarData } from '../../lib/reservas'
import { useAgora } from '../../lib/useAgora'
import { ComparativoVersoes } from './ComparativoVersoes'

export function VersoesPropostaPage() {
  const { id } = useParams()
  const db = useDb()
  const agora = useAgora()
  const [comparando, setComparando] = useState(false)

  const proposta = db.propostas.find((p) => p.id === id)
  if (!proposta) {
    return (
      <main className="conteudo">
        <section className="card vazio">
          <h2>Proposta não encontrada</h2>
          <Link to="/propostas" className="btn btn--secundario">
            Voltar para propostas
          </Link>
        </section>
      </main>
    )
  }

  const situacao = situacaoProposta(proposta, agora)
  const atual = versaoAtual(proposta)
  const calculo = calcularCondicoes(atual.condicoes)
  const situacaoAtual = SITUACAO_VERSAO[situacaoVersao(proposta, atual, agora)]
  const podeVersionar = permiteNovaVersao(proposta, agora)
  const historico = [...proposta.versoes].reverse()

  type Linha = { id: string; data: string; titulo: string; autor: string; detalhe: string; situacao: { rotulo: string; variante: string } }
  const decisoes: Linha[] = [
    ...proposta.historico
      .filter((e) => EVENTOS_DE_DECISAO.includes(e.tipo))
      .map((e) => ({ ...e, situacao: SITUACAO_EVENTO[e.tipo] })),
    ...eventosDePrazo(proposta, agora),
  ].sort((a, b) => a.data.localeCompare(b.data))

  const descricaoAtual =
    situacao === 'rascunho'
      ? 'Rascunho ainda não enviado para aprovação.'
      : situacao === 'contraproposta'
        ? 'Contraproposta enviada ao cliente; aguardando a resposta dele.'
        : situacao === 'em_analise' || situacao === 'enviada' || situacao === 'aguardando_diretoria'
          ? 'É esta a versão que o aprovador está analisando.'
          : `Proposta ${SITUACAO_PROPOSTA[situacao].rotulo.toLowerCase()}.`

  return (
    <>
      <header className="cabecalho">
        <div>
          <nav className="migalhas" aria-label="Você está em">
            <Link to="/propostas">Propostas</Link>
            <span aria-hidden>›</span>
            <Link to={`/propostas/${proposta.id}`}>{proposta.codigo}</Link>
            <span aria-hidden>›</span>
            <span>Versões</span>
          </nav>
          <h1 className="cabecalho__titulo">{proposta.codigo} — Versões</h1>
          <p className="cabecalho__subtitulo">Cada edição gera uma nova versão preservando as condições anteriores · RF18</p>
        </div>
        <div className="cabecalho__acoes">
          <button
            type="button"
            className="btn btn--secundario"
            onClick={() => setComparando(true)}
            disabled={proposta.versoes.length < 2}
            title={proposta.versoes.length < 2 ? 'Só existe uma versão' : undefined}
          >
            Comparar versões
          </button>
          {podeVersionar ? (
            <Link to={`/propostas/${proposta.id}/versoes/nova`} className="btn btn--primario">
              Nova versão
            </Link>
          ) : situacao === 'rascunho' ? (
            <Link to={`/propostas/${proposta.id}/editar`} className="btn btn--primario">
              Continuar edição
            </Link>
          ) : (
            <button type="button" className="btn btn--primario" disabled title="A proposta não está mais em negociação">
              Nova versão
            </button>
          )}
        </div>
      </header>

      <main className="conteudo pilha">
        <section className="card secao" aria-labelledby="versao-atual">
          <div className="secao__cabecalho">
            <h2 id="versao-atual" className="card__titulo">
              Versão atual — v{atual.numero}
            </h2>
            <p className="card__subtitulo">{descricaoAtual}</p>
          </div>
          <dl className="ficha ficha--6">
            <div><dt>Valor proposto</dt><dd>{formatarMoedaInteira(calculo.valorProposto)}</dd></div>
            <div><dt>Entrada</dt><dd>{formatarMoedaInteira(atual.condicoes.entrada)}</dd></div>
            <div><dt>Parcelas</dt><dd>{atual.condicoes.parcelas}x</dd></div>
            <div><dt>Validade</dt><dd>{proposta.expiraEm ? formatarData(proposta.expiraEm) : '—'}</dd></div>
            <div><dt>Situação</dt><dd><Badge variante={situacaoAtual.variante}>{situacaoAtual.rotulo}</Badge></dd></div>
            <div><dt>Autor</dt><dd>{atual.autor}</dd></div>
          </dl>
          <p className="nota-regra">RF18 — versões anteriores ficam somente leitura; nada é sobrescrito.</p>
        </section>

        <section className="card">
          <div className="card__cabecalho">
            <div>
              <h2 className="card__titulo">Histórico de versões</h2>
              <p className="card__subtitulo">Autor, data e o que mudou em cada versão.</p>
            </div>
          </div>
          <div className="tabela-wrap">
            <table className="tabela tabela--quebra">
              <thead>
                <tr>
                  <th>Versão</th>
                  <th>Data</th>
                  <th>Autor</th>
                  <th>O que mudou</th>
                  <th>Valor</th>
                  <th>Situação</th>
                  <th><span className="sr-only">Documento</span></th>
                </tr>
              </thead>
              <tbody>
                {historico.map((v) => {
                  const s = SITUACAO_VERSAO[situacaoVersao(proposta, v, agora)]
                  return (
                    <tr key={v.numero}>
                      <td className="tabela__destaque">v{v.numero}</td>
                      <td>{formatarData(v.enviadaEm ?? v.criadaEm)}</td>
                      <td>{v.autor}</td>
                      <td>
                        {v.oQueMudou}
                        {v.comentario && <span className="texto-fraco tabela__comentario">“{v.comentario}”</span>}
                      </td>
                      <td>{formatarMoedaInteira(calcularCondicoes(v.condicoes).valorProposto)}</td>
                      <td>
                        <Badge variante={s.variante}>{s.rotulo}</Badge>
                      </td>
                      <td>
                        <Link
                          to={`/propostas/${proposta.id}/documento?versao=${v.numero}`}
                          className="link"
                          aria-label={`Visualizar PDF da versão ${v.numero}`}
                        >
                          Visualizar PDF
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="card__cabecalho">
            <div>
              <h2 className="card__titulo">Decisões e prazos</h2>
              <p className="card__subtitulo">Trilha de aprovação e controle de validade · RF19, RF20 e RF21</p>
            </div>
          </div>
          {decisoes.length === 0 ? (
            <p className="card__vazio">Nenhuma decisão ainda: a proposta não foi enviada.</p>
          ) : (
            <div className="tabela-wrap">
              <table className="tabela tabela--quebra">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Evento</th>
                    <th>Responsável</th>
                    <th>Detalhe</th>
                    <th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {decisoes.map((e) => (
                    <tr key={e.id}>
                      <td className="tabela__destaque">{formatarData(e.data)}</td>
                      <td>{e.titulo}</td>
                      <td>{e.autor}</td>
                      <td>{e.detalhe}</td>
                      <td>
                        <Badge variante={e.situacao.variante}>{e.situacao.rotulo}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {comparando && <ComparativoVersoes aberto versoes={proposta.versoes} onFechar={() => setComparando(false)} />}
    </>
  )
}
