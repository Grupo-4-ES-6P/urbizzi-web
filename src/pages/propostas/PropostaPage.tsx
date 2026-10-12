import { FileText, Paperclip, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { Dialogo } from '../../components/Dialogo'
import { Badge, Campo, Spinner } from '../../components/ui'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useDb } from '../../data/db'
import { reservaAtiva, rotuloImovel } from '../../data/selectors'
import type { EtapaAprovacao, SituacaoProposta } from '../../data/types'
import { formatarDecimal, formatarMoedaInteira } from '../../lib/format'
import {
  etapaAtual,
  formatarParcelas,
  formatarPercentual,
  formatarValidade,
  podeDecidir,
  posicaoNoFluxo,
  SITUACAO_PROPOSTA,
} from '../../lib/propostas'
import { formatarData, SITUACAO_RESERVA, classificarReserva } from '../../lib/reservas'
import { useAgora } from '../../lib/useAgora'
import { aprovarProposta, iniciarAnalise, recusarProposta } from '../../services/propostas'
import { dataHora, montarLinhas } from './proposta'

/** Texto do estado de cada etapa: nunca depende só da cor do marcador. */
function estadoDaEtapa(e: EtapaAprovacao, situacao: SituacaoProposta, usuarioId: string | undefined) {
  if (e.estado === 'concluida') return { texto: e.concluidaEm ? dataHora(e.concluidaEm) : 'Concluída', classe: '' }
  if (e.estado === 'recusada') return { texto: `Recusada${e.concluidaEm ? ` em ${dataHora(e.concluidaEm)}` : ''}`, classe: 'fluxo__estado--recusada' }
  if (e.estado === 'aguardando') {
    if (situacao === 'expirada') return { texto: 'Expirou sem decisão', classe: 'fluxo__estado--recusada' }
    if (situacao === 'contraproposta') return { texto: 'Contraproposta com o cliente', classe: 'fluxo__estado--voce' }
    return e.responsavelId === usuarioId
      ? { texto: 'Aguardando você', classe: 'fluxo__estado--voce' }
      : { texto: 'Aguardando decisão', classe: 'fluxo__estado--voce' }
  }
  if (e.automatica) return { texto: situacao === 'aprovada' ? 'Pendente · geração automática' : 'Pendente', classe: '' }
  return { texto: 'Pendente', classe: '' }
}

export function PropostaPage() {
  const { id } = useParams()
  const db = useDb()
  const agora = useAgora()
  const navigate = useNavigate()
  const notificar = useToast()
  const { usuario } = useAuth()
  const [dialogo, setDialogo] = useState<'aprovar' | 'recusar' | null>(null)
  const [motivo, setMotivo] = useState('')
  const [erroMotivo, setErroMotivo] = useState<string>()
  const [processando, setProcessando] = useState(false)

  const proposta = db.propostas.find((p) => p.id === id)
  const decide = !!proposta && podeDecidir(proposta, usuario?.id, agora)
  const deveIniciarAnalise = decide && proposta.situacao === 'enviada' && etapaAtual(proposta)?.tipo === 'analise_comercial'

  // Ao abrir a proposta enviada, o responsável pela análise comercial a coloca "Em análise".
  useEffect(() => {
    if (deveIniciarAnalise && proposta && usuario) void iniciarAnalise(proposta.id, usuario)
  }, [deveIniciarAnalise, proposta, usuario])

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

  const [linha] = montarLinhas(db, [proposta], agora)
  const { situacao, versao, calculo, imovel, cliente, reserva } = linha
  const c = versao.condicoes
  const s = SITUACAO_PROPOSTA[situacao]
  const minimo = imovel?.valores.minimo ?? null
  const etapa = etapaAtual(proposta)
  const posicao = posicaoNoFluxo(proposta)
  const ultimaEtapa = !!etapa && proposta.etapas.indexOf(etapa) === proposta.etapas.length - 2
  const decisor = { id: usuario?.id ?? '', nome: usuario?.nome ?? 'Administrador' }
  const historico = [
    ...proposta.historico.map((e) => ({ id: e.id, data: e.data, texto: `${e.titulo} — ${e.autor}`, detalhe: e.detalhe })),
    ...(reserva ? [{ id: `${reserva.id}-criacao`, data: reserva.criadaEm, texto: 'Reserva registrada para o lote', detalhe: reserva.codigo }] : []),
  ].sort((a, b) => b.data.localeCompare(a.data))

  const aprovar = async () => {
    setProcessando(true)
    try {
      const { proposta: atualizada, codigoVenda } = await aprovarProposta(proposta.id, decisor)
      notificar(
        codigoVenda
          ? `Proposta aprovada. Venda ${codigoVenda} registrada; o contrato será gerado automaticamente.`
          : `Etapa aprovada. A proposta segue para ${etapaAtual(atualizada)?.titulo.toLowerCase() ?? 'a próxima etapa'}.`,
      )
    } catch (e) {
      notificar(e instanceof Error ? e.message : 'Não foi possível aprovar a proposta.', 'erro')
    } finally {
      setProcessando(false)
      setDialogo(null)
    }
  }

  const recusar = async () => {
    if (!motivo.trim()) {
      setErroMotivo('Informe o motivo da recusa.')
      return
    }
    setProcessando(true)
    try {
      await recusarProposta(proposta.id, motivo, decisor)
      notificar('Proposta recusada. O corretor será avisado.', 'info')
      setDialogo(null)
    } catch (e) {
      notificar(e instanceof Error ? e.message : 'Não foi possível recusar a proposta.', 'erro')
    } finally {
      setProcessando(false)
    }
  }

  const situacaoReserva = reserva ? SITUACAO_RESERVA[classificarReserva(reserva, agora)] : null

  return (
    <>
      <header className="cabecalho">
        <div>
          <nav className="migalhas" aria-label="Você está em">
            <Link to="/propostas">Propostas</Link>
            <span aria-hidden>›</span>
            <span>Proposta {proposta.codigo}</span>
          </nav>
          <div className="cabecalho__linha">
            <h1 className="cabecalho__titulo">{linha.imovelRotulo}</h1>
            <Badge variante={s.variante}>{s.rotulo}</Badge>
          </div>
          <p className="cabecalho__subtitulo">
            {proposta.codigo} · versão v{versao.numero} ·{' '}
            <Link to={`/propostas/${proposta.id}/versoes`} className="link">
              ver versões
            </Link>
          </p>
        </div>
        <div className="cabecalho__acoes">
          <Link to={`/propostas/${proposta.id}/documento`} className="btn btn--secundario">
            <FileText size={15} aria-hidden /> Visualizar PDF
          </Link>
          {decide ? (
            <>
              <button type="button" className="btn btn--contorno-perigo" onClick={() => setDialogo('recusar')} disabled={processando}>
                Recusar proposta
              </button>
              <button
                type="button"
                className="btn btn--suave"
                onClick={() => navigate(`/propostas/${proposta.id}/versoes/nova?contraproposta=1`)}
                disabled={processando}
              >
                Contraproposta
              </button>
              <button type="button" className="btn btn--primario" onClick={() => setDialogo('aprovar')} disabled={processando}>
                {processando && <Spinner />} Aprovar proposta
              </button>
            </>
          ) : situacao === 'rascunho' ? (
            <Link to={`/propostas/${proposta.id}/editar`} className="btn btn--primario">
              Continuar edição
            </Link>
          ) : (
            <Link to={`/propostas/${proposta.id}/versoes`} className="btn btn--secundario">
              Versões
            </Link>
          )}
        </div>
      </header>

      <main className="conteudo">
        <div className="detalhe">
          <div className="detalhe__principal">
            {situacao === 'recusada' && proposta.motivoRecusa && (
              <div className="alerta alerta--erro" role="status">
                <strong>Proposta recusada:</strong> {proposta.motivoRecusa}
              </div>
            )}
            {situacao === 'expirada' && (
              <div className="alerta alerta--aviso" role="status">
                A validade terminou sem decisão: a proposta expirou e a reserva segue com o próprio prazo (RF21).
              </div>
            )}

            <section className="card secao">
              <div className="secao__cabecalho">
                <h2 className="card__titulo">Valores</h2>
                <p className="card__subtitulo">Comparativo com a tabela vigente do empreendimento.</p>
              </div>
              <dl className="valores">
                <div className="valores__tabela"><dt>Valor de tabela</dt><dd>{formatarMoedaInteira(c.valorTabela)}</dd></div>
                <div><dt>Valor proposto</dt><dd>{formatarMoedaInteira(calculo.valorProposto)}</dd></div>
                <div>
                  <dt>Desconto</dt>
                  <dd className={c.descontoPercentual > 0 ? 'valores__negativo' : undefined}>
                    {c.descontoPercentual > 0 ? '−' : ''}
                    {formatarPercentual(c.descontoPercentual)}
                  </dd>
                </div>
                <div><dt>Mínimo aceito</dt><dd className="valores__positivo">{minimo ? formatarMoedaInteira(minimo) : '—'}</dd></div>
              </dl>
              {minimo !== null && calculo.valorProposto <= minimo && (
                <div className={`alerta ${calculo.valorProposto < minimo ? 'alerta--erro' : 'alerta--aviso'} valores__alerta`} role="status">
                  <TriangleAlert size={15} aria-hidden />
                  {calculo.valorProposto < minimo
                    ? `A proposta está abaixo do valor mínimo autorizado para este lote (${formatarMoedaInteira(minimo)}).`
                    : 'A proposta atinge exatamente o valor mínimo autorizado para este lote.'}
                </div>
              )}
            </section>

            <section className="card secao">
              <div className="secao__cabecalho">
                <h2 className="card__titulo">Condições de pagamento</h2>
                <p className="card__subtitulo">
                  {versao.enviadaEm ? `Enviadas por ${versao.autor} em ${formatarData(versao.enviadaEm)}` : 'Rascunho ainda não enviado'}
                </p>
              </div>
              <dl className="ficha">
                <div><dt>Forma</dt><dd>{c.formaPagamento || '—'}</dd></div>
                <div><dt>Entrada</dt><dd>{formatarMoedaInteira(c.entrada)} ({formatarPercentual(calculo.entradaPercentual)})</dd></div>
                <div><dt>Parcelas</dt><dd>{formatarParcelas(c.parcelas, calculo.valorParcela)}</dd></div>
                <div><dt>Índice</dt><dd>{c.indiceCorrecao}</dd></div>
                <div><dt>Primeira parcela</dt><dd>{formatarData(c.primeiroVencimento)}</dd></div>
                <div><dt>Escritura</dt><dd>{c.escritura}</dd></div>
                <div><dt>Garantia</dt><dd>{c.garantia}</dd></div>
                <div><dt>Validade</dt><dd>{formatarValidade(c.validadeDias)}{proposta.expiraEm ? ` · até ${formatarData(proposta.expiraEm)}` : ''}</dd></div>
              </dl>
            </section>

            <section className="card secao">
              <div className="secao__cabecalho">
                <h2 className="card__titulo">Cliente e imóvel</h2>
              </div>
              <dl className="ficha">
                <div><dt>Cliente</dt><dd>{cliente ? <Link to={`/clientes/${cliente.id}`} className="link">{cliente.nome}</Link> : linha.clienteNome}</dd></div>
                <div><dt>{cliente?.tipoPessoa === 'juridica' ? 'CNPJ' : 'CPF'}</dt><dd>{cliente?.cpfCnpj || '—'}</dd></div>
                <div><dt>Contato</dt><dd>{cliente?.telefone || '—'}</dd></div>
                <div><dt>Corretor</dt><dd>{linha.corretorNome}</dd></div>
                <div><dt>Imóvel</dt><dd>{imovel ? <Link to={`/imoveis/${imovel.id}`} className="link">{rotuloImovel(imovel)}</Link> : linha.imovelRotulo}</dd></div>
                <div><dt>Área</dt><dd>{imovel?.dimensoes.areaTotal ? `${formatarDecimal(imovel.dimensoes.areaTotal)} m²` : '—'}</dd></div>
                <div><dt>Código</dt><dd>{imovel?.codigo ?? '—'}</dd></div>
                <div>
                  <dt>Reserva</dt>
                  <dd>
                    {reserva ? (
                      <Link to={`/reservas/${reserva.id}`} className="link">
                        {reservaAtiva(reserva, agora) ? `Ativa até ${formatarData(reserva.expiraEm)}` : `${situacaoReserva?.rotulo} · ${reserva.codigo}`}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </dd>
                </div>
              </dl>
              {(versao.observacoes || versao.anexos.length > 0) && (
                <div className="caixa-nota">
                  <p className="caixa-nota__titulo">Observações do corretor</p>
                  {versao.observacoes && <p>{versao.observacoes}</p>}
                  {versao.anexos.length > 0 && (
                    <ul className="anexos" aria-label="Anexos">
                      {versao.anexos.map((a) => (
                        <li key={a} className="anexos__item">
                          <Paperclip size={13} aria-hidden /> {a}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </section>
          </div>

          <aside className="detalhe__lateral pilha" aria-label="Aprovação e histórico">
            <section className="card secao">
              <div className="secao__cabecalho">
                <h2 className="card__titulo">Fluxo de aprovação</h2>
                <p className="card__subtitulo">
                  {proposta.etapas.length ? `Etapa ${posicao.atual} de ${posicao.total}` : 'Ainda não enviada para aprovação'}
                </p>
              </div>
              {proposta.etapas.length > 0 && (
                <ol className="fluxo">
                  {proposta.etapas.map((e) => {
                    const estado = estadoDaEtapa(e, situacao, usuario?.id)
                    return (
                      <li key={e.tipo} className={`fluxo__etapa fluxo__etapa--${e.estado}`} aria-current={e.estado === 'aguardando' ? 'step' : undefined}>
                        <span className="fluxo__marcador" aria-hidden />
                        <div>
                          <p className="fluxo__titulo">{e.titulo}</p>
                          <p className="fluxo__detalhe">
                            {e.automatica ? e.cargo : `${e.responsavelNome} · ${e.cargo}`}
                          </p>
                          <p className={`fluxo__estado ${estado.classe}`}>{estado.texto}</p>
                        </div>
                      </li>
                    )
                  })}
                </ol>
              )}
            </section>

            <section className="card secao">
              <div className="secao__cabecalho">
                <h2 className="card__titulo">Histórico</h2>
                <p className="card__subtitulo">Registro imutável de auditoria · RF32</p>
              </div>
              <ol className="historico-lista">
                {historico.map((h) => (
                  <li key={h.id}>
                    <time dateTime={h.data}>{dataHora(h.data)}</time>
                    <span>{h.texto}</span>
                    {h.detalhe && <span className="texto-fraco">{h.detalhe}</span>}
                  </li>
                ))}
              </ol>
            </section>
          </aside>
        </div>
      </main>

      <Dialogo
        aberto={dialogo === 'aprovar'}
        titulo={ultimaEtapa ? 'Aprovar a proposta?' : `Aprovar a etapa "${etapa?.titulo}"?`}
        descricao={
          ultimaEtapa
            ? `A proposta fica Aprovada, a venda de ${formatarMoedaInteira(calculo.valorProposto)} é registrada e o contrato fica pendente de geração automática.`
            : 'A proposta segue para a próxima etapa do fluxo de aprovação.'
        }
        textoConfirmar={processando ? 'Aprovando…' : 'Aprovar'}
        textoCancelar="Voltar"
        carregando={processando}
        onCancelar={() => setDialogo(null)}
        onConfirmar={aprovar}
      />
      <Dialogo
        aberto={dialogo === 'recusar'}
        titulo={`Recusar a proposta ${proposta.codigo}?`}
        descricao="A recusa encerra a negociação desta proposta e fica registrada no histórico."
        textoConfirmar={processando ? 'Recusando…' : 'Recusar proposta'}
        textoCancelar="Voltar"
        perigoso
        carregando={processando}
        onCancelar={() => {
          setDialogo(null)
          setErroMotivo(undefined)
        }}
        onConfirmar={recusar}
      >
        <Campo rotulo="Motivo da recusa" erro={erroMotivo}>
          {(p) => (
            <textarea
              {...p}
              className="input input--area"
              rows={3}
              placeholder="Ex.: desconto acima da política do empreendimento"
              value={motivo}
              onChange={(e) => {
                setMotivo(e.target.value)
                setErroMotivo(undefined)
              }}
            />
          )}
        </Campo>
      </Dialogo>
    </>
  )
}
