import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

import { Dialogo } from '../../components/Dialogo'
import { InputNumerico } from '../../components/InputNumerico'
import { Campo } from '../../components/ui'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { MOTIVOS_BLOQUEIO, MOTIVOS_CANCELAMENTO, rotuloSituacao } from '../../data/catalogos'
import { useDb } from '../../data/db'
import { formatarMoedaInteira } from '../../lib/format'
import { bloquearImovel, cancelarVenda, reabilitarImovel } from '../../services/api'
import { CabecalhoLote } from './CabecalhoLote'
import { nomeCurtoLote, useImovelDaRota } from './lote'

type Acao = 'bloquear' | 'reabilitar' | 'cancelar'

const hoje = () => new Date().toISOString().slice(0, 10)

export function AcoesPage() {
  const db = useDb()
  const navigate = useNavigate()
  const notificar = useToast()
  const { usuario } = useAuth()
  const { imovel, naoEncontrado } = useImovelDaRota()
  const vendasAtivas = db.vendas.filter((v) => v.imovelId === imovel?.id && v.status === 'ativa')

  const disponivel = {
    bloquear: imovel?.situacao === 'disponivel',
    reabilitar: imovel?.situacao === 'bloqueado',
    cancelar: imovel?.situacao === 'vendido' && vendasAtivas.length > 0,
  }
  const primeira = (Object.keys(disponivel) as Acao[]).find((a) => disponivel[a]) ?? null

  const [escolhida, setEscolhida] = useState<Acao | null>(null)
  const acao = escolhida && disponivel[escolhida] ? escolhida : primeira
  const [bloqueio, setBloqueio] = useState({ motivo: MOTIVOS_BLOQUEIO[0], justificativa: '', previsao: '' })
  const [reabilitacao, setReabilitacao] = useState({ documento: '', observacao: '' })
  const [cancelamento, setCancelamento] = useState({ vendaId: '', motivo: MOTIVOS_CANCELAMENTO[0], dataDistrato: hoje(), devolucao: null as number | null })
  const [erros, setErros] = useState<Record<string, string>>({})
  const [confirmar, setConfirmar] = useState(false)
  const [executando, setExecutando] = useState(false)

  if (!imovel) return <>{naoEncontrado}</>
  const vendaId = cancelamento.vendaId || vendasAtivas[0]?.id || ''
  const venda = vendasAtivas.find((v) => v.id === vendaId)

  const validar = () => {
    const e: Record<string, string> = {}
    if (acao === 'bloquear' && bloqueio.justificativa.trim().length < 10) {
      e.justificativa = 'Explique o bloqueio (mínimo de 10 caracteres).'
    }
    if (acao === 'bloquear' && bloqueio.previsao && bloqueio.previsao < hoje()) e.previsao = 'A previsão não pode estar no passado.'
    if (acao === 'reabilitar' && !reabilitacao.documento.trim()) e.documento = 'Informe o documento que resolveu a pendência.'
    if (acao === 'cancelar') {
      if (!cancelamento.dataDistrato) e.dataDistrato = 'Informe a data do distrato.'
      if (cancelamento.devolucao === null) e.devolucao = 'Informe o valor (use 0 se não houver).'
      else if (venda && cancelamento.devolucao > venda.valor) e.devolucao = 'A devolução não pode passar do valor da venda.'
    }
    setErros(e)
    return Object.keys(e).length === 0
  }

  const executar = async () => {
    const autor = usuario?.nome ?? 'Administrador'
    setExecutando(true)
    try {
      if (acao === 'bloquear') {
        await bloquearImovel(imovel.id, { ...bloqueio, previsao: bloqueio.previsao || undefined }, autor)
        notificar('Imóvel bloqueado e retirado do catálogo.')
      } else if (acao === 'reabilitar') {
        await reabilitarImovel(imovel.id, reabilitacao, autor)
        notificar('Imóvel reabilitado: está disponível novamente.')
      } else if (acao === 'cancelar' && venda) {
        await cancelarVenda(venda.id, { motivo: cancelamento.motivo, dataDistrato: cancelamento.dataDistrato, devolucao: cancelamento.devolucao ?? 0 }, autor)
        notificar('Venda cancelada. O imóvel fica bloqueado até ser reabilitado.')
      }
      setConfirmar(false)
      navigate(`/imoveis/${imovel.id}/historico`)
    } catch (error_) {
      notificar(error_ instanceof Error ? error_.message : 'Não foi possível concluir a ação.', 'erro')
      setConfirmar(false)
    } finally {
      setExecutando(false)
    }
  }

  const titulos: Record<Acao, string> = { bloquear: 'Bloquear imóvel', reabilitar: 'Reabilitar imóvel', cancelar: 'Cancelar venda' }

  return (
    <>
      <CabecalhoLote
        imovel={imovel}
        secao="Ações administrativas"
        subtitulo="Bloqueio, reabilitação e cancelamento de venda · RF24, RF25 e RF26"
        acoes={
          <>
            <button type="button" className="btn btn--secundario" onClick={() => navigate(`/imoveis/${imovel.id}`)}>
              Voltar ao imóvel
            </button>
            <button
              type="button"
              className="btn btn--primario"
              disabled={!acao}
              onClick={() => validar() && setConfirmar(true)}
            >
              Confirmar ação
            </button>
          </>
        }
      />
      <main className="conteudo pilha">
        <p className="aviso-situacao">
          Situação atual: <strong>{rotuloSituacao(imovel.situacao)}</strong>
          {imovel.bloqueio && ` — ${imovel.bloqueio.motivo}`}. Escolha a ação e clique em “Confirmar ação”.
        </p>

        <SecaoAcao
          id="bloquear"
          titulo="Bloquear imóvel"
          subtitulo="Impede reserva, proposta e venda, e tira o imóvel do catálogo público."
          ativa={acao === 'bloquear'}
          habilitada={disponivel.bloquear}
          motivoDesabilitada="Só imóveis disponíveis podem ser bloqueados."
          onEscolher={() => setEscolhida('bloquear')}
          regra="RF26 — o bloqueio exige justificativa e fica registrado no histórico do imóvel."
        >
          <div className="grade">
            <Campo rotulo="Motivo do bloqueio" className="c-3">
              {(p) => (
                <select {...p} className="input select" value={bloqueio.motivo} onChange={(e) => setBloqueio({ ...bloqueio, motivo: e.target.value })}>
                  {MOTIVOS_BLOQUEIO.filter((m) => m !== 'Venda cancelada').map((m) => <option key={m}>{m}</option>)}
                </select>
              )}
            </Campo>
            <Campo rotulo="Justificativa" erro={erros.justificativa} className="c-6">
              {(p) => <input {...p} className="input" placeholder="Ex.: a averbação da unidade ainda não saiu no cartório." value={bloqueio.justificativa} onChange={(e) => setBloqueio({ ...bloqueio, justificativa: e.target.value })} />}
            </Campo>
            <Campo rotulo="Previsão de liberação" erro={erros.previsao} className="c-3">
              {(p) => <input {...p} type="date" className="input" min={hoje()} value={bloqueio.previsao} onChange={(e) => setBloqueio({ ...bloqueio, previsao: e.target.value })} />}
            </Campo>
          </div>
        </SecaoAcao>

        <SecaoAcao
          id="reabilitar"
          titulo="Reabilitar imóvel"
          subtitulo="Devolve o imóvel para Disponível depois de um bloqueio ou de uma venda cancelada."
          ativa={acao === 'reabilitar'}
          habilitada={disponivel.reabilitar}
          motivoDesabilitada="Só imóveis bloqueados podem ser reabilitados."
          onEscolher={() => setEscolhida('reabilitar')}
          regra="RF25 — somente perfis com permissão de gestor podem reabilitar um imóvel."
        >
          <div className="grade">
            <Campo rotulo="Situação de origem" className="c-3">
              {(p) => <input {...p} className="input" readOnly value={imovel.bloqueio ? `Bloqueado — ${imovel.bloqueio.motivo}` : rotuloSituacao(imovel.situacao)} />}
            </Campo>
            <Campo rotulo="Documento que resolveu a pendência" erro={erros.documento} className="c-3">
              {(p) => <input {...p} className="input" placeholder={`R-6/${imovel.matricula || '00000'}`} value={reabilitacao.documento} onChange={(e) => setReabilitacao({ ...reabilitacao, documento: e.target.value })} />}
            </Campo>
            <Campo rotulo="Observação" className="c-6">
              {(p) => <input {...p} className="input" placeholder="Ex.: averbação concluída em 20/05/2025." value={reabilitacao.observacao} onChange={(e) => setReabilitacao({ ...reabilitacao, observacao: e.target.value })} />}
            </Campo>
          </div>
        </SecaoAcao>

        <SecaoAcao
          id="cancelar"
          titulo="Cancelar venda"
          subtitulo="Desfaz uma venda registrada e devolve o imóvel ao estoque."
          ativa={acao === 'cancelar'}
          habilitada={disponivel.cancelar}
          motivoDesabilitada="Não há venda ativa para este imóvel."
          onEscolher={() => setEscolhida('cancelar')}
          regra="RF24 — o cancelamento exige motivo, gera lançamento na trilha de auditoria e só libera o imóvel após a reabilitação."
        >
          <div className="grade">
            <Campo rotulo="Venda" className="c-3">
              {(p) => (
                <select {...p} className="input select" value={vendaId} onChange={(e) => setCancelamento({ ...cancelamento, vendaId: e.target.value })}>
                  {vendasAtivas.length === 0 && <option value="">—</option>}
                  {vendasAtivas.map((v) => (
                    <option key={v.id} value={v.id}>{v.codigo} · {formatarMoedaInteira(v.valor)}</option>
                  ))}
                </select>
              )}
            </Campo>
            <Campo rotulo="Motivo do cancelamento" className="c-3">
              {(p) => (
                <select {...p} className="input select" value={cancelamento.motivo} onChange={(e) => setCancelamento({ ...cancelamento, motivo: e.target.value })}>
                  {MOTIVOS_CANCELAMENTO.map((m) => <option key={m}>{m}</option>)}
                </select>
              )}
            </Campo>
            <Campo rotulo="Data do distrato" erro={erros.dataDistrato} className="c-3">
              {(p) => <input {...p} type="date" className="input" max={hoje()} value={cancelamento.dataDistrato} onChange={(e) => setCancelamento({ ...cancelamento, dataDistrato: e.target.value })} />}
            </Campo>
            <Campo rotulo="Devolução ao cliente" erro={erros.devolucao} className="c-3">
              {(p) => <InputNumerico {...p} prefixo="R$" valor={cancelamento.devolucao} onChange={(v) => setCancelamento({ ...cancelamento, devolucao: v })} />}
            </Campo>
          </div>
        </SecaoAcao>
      </main>

      <Dialogo
        aberto={confirmar}
        titulo={acao ? `${titulos[acao]}?` : ''}
        descricao={
          <>
            A ação será aplicada a <strong>{nomeCurtoLote(imovel)}</strong> e registrada no histórico, que não pode ser
            editado.
          </>
        }
        textoConfirmar={executando ? 'Aplicando…' : 'Confirmar'}
        perigoso={acao !== 'reabilitar'}
        carregando={executando}
        onCancelar={() => setConfirmar(false)}
        onConfirmar={executar}
      />
    </>
  )
}

interface SecaoAcaoProps {
  id: Acao
  titulo: string
  subtitulo: string
  ativa: boolean
  habilitada: boolean
  motivoDesabilitada: string
  regra: string
  onEscolher: () => void
  children: ReactNode
}

function SecaoAcao({ id, titulo, subtitulo, ativa, habilitada, motivoDesabilitada, regra, onEscolher, children }: Readonly<SecaoAcaoProps>) {
  return (
    <section className={`card secao acao ${ativa ? 'acao--ativa' : ''} ${habilitada ? '' : 'acao--desabilitada'}`}>
      <label className="acao__cabecalho">
        <input type="radio" name="acao" value={id} checked={ativa} disabled={!habilitada} onChange={onEscolher} />
        <span>
          <span className="card__titulo">{titulo}</span>
          <span className="card__subtitulo">{habilitada ? subtitulo : motivoDesabilitada}</span>
        </span>
      </label>
      <fieldset disabled={!habilitada || !ativa} className="acao__campos">
        <legend className="sr-only">{titulo}</legend>
        {children}
      </fieldset>
      <p className="nota-regra">{regra}</p>
    </section>
  )
}
