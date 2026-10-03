import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Dialogo } from '../../components/Dialogo'
import { Badge, Campo } from '../../components/ui'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useDb } from '../../data/db'
import { formatarMoedaInteira, formatarTempoRestante } from '../../lib/format'
import {
  correspondeAoFiltro,
  estenderExpiracao,
  formatarData,
  lerValidade,
  MOTIVOS_CANCELAMENTO_RESERVA,
  SITUACAO_RESERVA,
  STATUS_RESERVA,
  VALIDADE_MAXIMA_DIAS,
} from '../../lib/reservas'
import { useAgora } from '../../lib/useAgora'
import { cancelarReserva, renovarReserva } from '../../services/api'
import { montarLinhas } from './reserva'

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export function ReservaPage() {
  const { id } = useParams()
  const db = useDb()
  const agora = useAgora()
  const notificar = useToast()
  const { usuario } = useAuth()
  const autor = usuario?.nome ?? 'Administrador'

  const [diasRenovacao, setDiasRenovacao] = useState('15')
  const [justificativa, setJustificativa] = useState('')
  const [errosRenovacao, setErrosRenovacao] = useState<{ dias?: string; justificativa?: string }>({})
  const [motivo, setMotivo] = useState('')
  const [detalhamento, setDetalhamento] = useState('')
  const [erroMotivo, setErroMotivo] = useState<string>()
  const [confirmarCancelamento, setConfirmarCancelamento] = useState(false)
  const [processando, setProcessando] = useState(false)

  const reserva = db.reservas.find((r) => r.id === id)
  if (!reserva) {
    return (
      <main className="conteudo">
        <section className="card vazio">
          <h2>Reserva não encontrada</h2>
          <Link to="/reservas" className="btn btn--secundario">
            Voltar para reservas
          </Link>
        </section>
      </main>
    )
  }

  const [linha] = montarLinhas(db, [reserva], agora)
  const ativa = correspondeAoFiltro(linha.situacao, 'ativas')
  const limiteAtingido = reserva.renovacoesUsadas >= reserva.renovacoesPermitidas
  const dias = lerValidade(diasRenovacao)
  const novaExpiracao = dias !== null ? estenderExpiracao(reserva.expiraEm, dias) : null
  const situacao = SITUACAO_RESERVA[linha.situacao]
  const historico = [...reserva.historico].sort((a, b) => a.data.localeCompare(b.data))

  const renovar = async () => {
    const e: typeof errosRenovacao = {}
    if (dias === null) e.dias = `Informe um número inteiro de 1 a ${VALIDADE_MAXIMA_DIAS}.`
    if (!justificativa.trim()) e.justificativa = 'Informe a justificativa da renovação.'
    setErrosRenovacao(e)
    if (Object.keys(e).length) return
    setProcessando(true)
    try {
      const renovada = await renovarReserva(reserva.id, { dias: dias!, justificativa }, autor)
      setJustificativa('')
      notificar(`Reserva renovada até ${formatarData(renovada.expiraEm)}.`)
    } catch (err) {
      notificar(err instanceof Error ? err.message : 'Não foi possível renovar a reserva.', 'erro')
    } finally {
      setProcessando(false)
    }
  }

  const solicitarCancelamento = () => {
    setErroMotivo(motivo ? undefined : 'Selecione o motivo do cancelamento.')
    if (motivo) setConfirmarCancelamento(true)
  }

  const cancelar = async () => {
    setProcessando(true)
    try {
      await cancelarReserva(reserva.id, { motivo, detalhamento }, autor)
      notificar('Reserva cancelada. O imóvel voltou para Disponível.')
    } catch (err) {
      notificar(err instanceof Error ? err.message : 'Não foi possível cancelar a reserva.', 'erro')
    } finally {
      setProcessando(false)
      setConfirmarCancelamento(false)
    }
  }

  return (
    <>
      <header className="cabecalho">
        <div>
          <nav className="migalhas" aria-label="Você está em">
            <Link to="/reservas">Reservas</Link>
            <span aria-hidden>›</span>
            <span>{reserva.codigo}</span>
          </nav>
          <h1 className="cabecalho__titulo">Reserva {reserva.codigo}</h1>
          <p className="cabecalho__subtitulo">
            {linha.imovelRotulo} · {linha.clienteNome}
          </p>
        </div>
        <div className="cabecalho__acoes">
          {ativa ? (
            <>
              <button type="button" className="btn btn--secundario" onClick={solicitarCancelamento} disabled={processando}>
                Cancelar reserva
              </button>
              <button type="button" className="btn btn--primario" onClick={renovar} disabled={processando || limiteAtingido}>
                Renovar reserva
              </button>
            </>
          ) : (
            <Link to="/reservas" className="btn btn--secundario">
              Voltar
            </Link>
          )}
        </div>
      </header>

      <main className="conteudo pilha">
        <section className="card secao">
          <div className="secao__cabecalho">
            <h2 className="card__titulo">Situação atual</h2>
            <p className="card__subtitulo">
              {ativa
                ? 'Enquanto esta reserva estiver ativa, nenhuma outra pode ser criada para o mesmo imóvel.'
                : 'Esta reserva não está mais ativa; o imóvel pode receber uma nova reserva.'}
            </p>
          </div>
          <dl className="ficha ficha--6">
            <div><dt>Status</dt><dd className="ficha__status">{STATUS_RESERVA[linha.situacao]} <Badge variante={situacao.variante}>{situacao.rotulo}</Badge></dd></div>
            <div><dt>Criada em</dt><dd>{formatarData(reserva.dataInicio)}</dd></div>
            <div><dt>Expira em</dt><dd>{formatarData(reserva.expiraEm)}</dd></div>
            <div><dt>Tempo restante</dt><dd className={linha.situacao === 'critico' ? 'texto-critico' : undefined}>{ativa ? formatarTempoRestante(linha.restante) : '—'}</dd></div>
            <div><dt>Renovações usadas</dt><dd>{reserva.renovacoesUsadas} de {reserva.renovacoesPermitidas}</dd></div>
            <div><dt>Responsável</dt><dd>{linha.corretorNome}</dd></div>
          </dl>
        </section>

        <section className="card secao">
          <div className="secao__cabecalho">
            <h2 className="card__titulo">Imóvel, cliente e condições</h2>
            <p className="card__subtitulo">Dados registrados na criação da reserva.</p>
          </div>
          <dl className="ficha">
            <div><dt>Imóvel</dt><dd>{linha.imovel ? <Link to={`/imoveis/${linha.imovel.id}`} className="link">{linha.imovelRotulo}</Link> : linha.imovelRotulo}</dd></div>
            <div><dt>Cliente</dt><dd>{linha.cliente ? <Link to={`/clientes/${linha.cliente.id}`} className="link">{linha.clienteNome}</Link> : linha.clienteNome}</dd></div>
            <div><dt>CPF / CNPJ</dt><dd>{linha.cliente?.cpfCnpj || '—'}</dd></div>
            <div><dt>Telefone</dt><dd>{linha.cliente?.telefone || '—'}</dd></div>
            <div><dt>Valor de tabela</dt><dd>{reserva.valorTabela ? formatarMoedaInteira(reserva.valorTabela) : '—'}</dd></div>
            <div><dt>Sinal acordado</dt><dd>{reserva.sinal ? formatarMoedaInteira(reserva.sinal) : '—'}</dd></div>
            <div><dt>Forma de pagamento</dt><dd>{reserva.formaPagamento || '—'}</dd></div>
            <div><dt>Desconto pretendido</dt><dd>{reserva.descontoPercentual !== null ? `${reserva.descontoPercentual.toLocaleString('pt-BR')}%` : '—'}</dd></div>
            <div><dt>Origem do interesse</dt><dd>{reserva.origemInteresse || '—'}</dd></div>
            <div><dt>Contato mais recente</dt><dd>{reserva.contatoRecente || '—'}</dd></div>
            <div><dt>Aviso ao responsável</dt><dd>{reserva.avisarHorasAntes}h antes</dd></div>
            <div><dt>Observações</dt><dd>{reserva.observacoes || '—'}</dd></div>
          </dl>
        </section>

        {ativa && (
          <section className="card secao">
            <div className="secao__cabecalho">
              <h2 className="card__titulo">Renovar reserva</h2>
              <p className="card__subtitulo">A renovação estende a validade a partir da expiração atual, sem liberar o imóvel.</p>
            </div>
            <fieldset disabled={limiteAtingido || processando} className="acao__campos">
              <legend className="sr-only">Renovar reserva</legend>
              <div className="grade">
                <Campo rotulo="Nova validade (dias)" erro={errosRenovacao.dias} className="c-2">
                  {(p) => <input {...p} type="number" inputMode="numeric" min={1} step={1} className="input" value={diasRenovacao} onChange={(e) => setDiasRenovacao(e.target.value)} />}
                </Campo>
                <Campo rotulo="Nova data de expiração" className="c-3">
                  {(p) => <input {...p} className="input" readOnly placeholder="—" value={novaExpiracao ? formatarData(novaExpiracao) : ''} />}
                </Campo>
                <Campo rotulo="Justificativa" erro={errosRenovacao.justificativa} className="c-7">
                  {(p) => (
                    <input
                      {...p}
                      className="input"
                      placeholder="Ex.: Cliente aguardando aprovação de crédito no banco."
                      value={justificativa}
                      onChange={(e) => setJustificativa(e.target.value)}
                    />
                  )}
                </Campo>
              </div>
            </fieldset>
            <p className="nota-regra">
              {limiteAtingido ? 'Limite de renovações do loteamento atingido. ' : ''}
              RF15 — cada renovação fica registrada com autor, data e justificativa, e respeita o limite de renovações do loteamento.
            </p>
          </section>
        )}

        {ativa && (
          <section className="card secao">
            <div className="secao__cabecalho">
              <h2 className="card__titulo">Cancelar reserva</h2>
              <p className="card__subtitulo">O cancelamento libera o imóvel imediatamente e mantém o histórico.</p>
            </div>
            <div className="grade">
              <Campo rotulo="Motivo do cancelamento" erro={erroMotivo} className="c-4">
                {(p) => (
                  <select
                    {...p}
                    className="input select"
                    value={motivo}
                    onChange={(e) => {
                      setMotivo(e.target.value)
                      setErroMotivo(undefined)
                    }}
                  >
                    <option value="">Selecione</option>
                    {MOTIVOS_CANCELAMENTO_RESERVA.map((m) => <option key={m}>{m}</option>)}
                  </select>
                )}
              </Campo>
              <Campo rotulo="Detalhamento" className="c-8">
                {(p) => (
                  <input
                    {...p}
                    className="input"
                    placeholder="Ex.: Crédito negado pelo banco; cliente pediu para liberar o lote."
                    value={detalhamento}
                    onChange={(e) => setDetalhamento(e.target.value)}
                  />
                )}
              </Campo>
            </div>
            <p className="nota-regra">Ao confirmar, o imóvel volta para Disponível e reaparece no catálogo público.</p>
          </section>
        )}

        <section className="card">
          <div className="card__cabecalho">
            <div>
              <h2 className="card__titulo">Histórico da reserva</h2>
              <p className="card__subtitulo">Toda alteração fica registrada para auditoria · RF32</p>
            </div>
          </div>
          <div className="tabela-wrap">
            <table className="tabela tabela--quebra">
              <thead>
                <tr>
                  <th>Data e hora</th>
                  <th>Evento</th>
                  <th>Responsável</th>
                  <th>Detalhe</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {historico.map((e) => (
                  <tr key={e.id}>
                    <td className="tabela__destaque">{dataHora(e.data)}</td>
                    <td>{e.titulo}</td>
                    <td>{e.autor}</td>
                    <td>{e.detalhe}</td>
                    <td>
                      <Badge variante={SITUACAO_RESERVA[e.situacao].variante}>{SITUACAO_RESERVA[e.situacao].rotulo}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <Dialogo
        aberto={confirmarCancelamento}
        titulo={`Cancelar a reserva ${reserva.codigo}?`}
        descricao="O imóvel volta imediatamente para Disponível. O histórico da reserva é mantido."
        textoConfirmar={processando ? 'Cancelando…' : 'Cancelar reserva'}
        textoCancelar="Voltar"
        perigoso
        carregando={processando}
        onCancelar={() => setConfirmarCancelamento(false)}
        onConfirmar={cancelar}
      />
    </>
  )
}
