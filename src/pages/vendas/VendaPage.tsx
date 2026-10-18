import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Dialogo } from '../../components/Dialogo'
import { Badge, Campo } from '../../components/ui'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useDb } from '../../data/db'
import type { TipoEventoVenda } from '../../data/types'
import { formatarMoedaInteira } from '../../lib/format'
import { formatarData } from '../../lib/reservas'
import {
  JUSTIFICATIVA_MINIMA,
  podeCancelar,
  podeCancelarVenda,
  podeConcluir,
  podeConcluirEscritura,
  STATUS_VENDA,
  validarJustificativa,
} from '../../lib/vendas'
import { cancelarVenda, concluirEscritura } from '../../services/vendas'
import { dataHora } from '../propostas/proposta'
import { montarLinhas } from './venda'

const TITULO_EVENTO: Record<TipoEventoVenda, string> = {
  registro: 'Venda registrada',
  conclusao: 'Escritura concluída',
  cancelamento: 'Venda cancelada',
}

export function VendaPage() {
  const { id } = useParams()
  const db = useDb()
  const notificar = useToast()
  const { usuario } = useAuth()

  const [dialogo, setDialogo] = useState<'cancelar' | 'concluir' | null>(null)
  const [justificativa, setJustificativa] = useState('')
  const [tentou, setTentou] = useState(false)
  const [processando, setProcessando] = useState(false)

  const venda = db.vendas.find((v) => v.id === id)
  if (!venda) {
    return (
      <main className="conteudo">
        <section className="card vazio">
          <h2>Venda não encontrada</h2>
          <Link to="/vendas" className="btn btn--secundario">
            Voltar para vendas
          </Link>
        </section>
      </main>
    )
  }

  const [linha] = montarLinhas(db, [venda])
  const status = STATUS_VENDA[venda.status]
  const proposta = venda.propostaId ? db.propostas.find((p) => p.id === venda.propostaId) : undefined
  const reserva = venda.reservaId ? db.reservas.find((r) => r.id === venda.reservaId) : undefined
  const erroJustificativa = tentou ? validarJustificativa(justificativa) : undefined
  const acao = { nome: usuario?.nome ?? 'Administrador', papel: usuario?.papel ?? '' }

  const fechar = () => {
    setDialogo(null)
    setJustificativa('')
    setTentou(false)
  }

  const executar = async (tipo: 'cancelar' | 'concluir') => {
    if (tipo === 'cancelar') {
      setTentou(true)
      if (validarJustificativa(justificativa)) return
    }
    setProcessando(true)
    try {
      if (tipo === 'cancelar') {
        await cancelarVenda(venda.id, { justificativa }, acao)
        notificar('Venda cancelada. O imóvel fica bloqueado até ser reabilitado.')
      } else {
        await concluirEscritura(venda.id, acao)
        notificar('Escritura concluída.')
      }
      fechar()
    } catch (e) {
      notificar(e instanceof Error ? e.message : 'Não foi possível concluir a ação.', 'erro')
      setDialogo(null)
    } finally {
      setProcessando(false)
    }
  }

  return (
    <>
      <header className="cabecalho">
        <div>
          <nav className="migalhas" aria-label="Você está em">
            <Link to="/vendas">Vendas</Link>
            <span aria-hidden>›</span>
            <span>{venda.codigo}</span>
          </nav>
          <h1 className="cabecalho__titulo">Venda {venda.codigo}</h1>
          <p className="cabecalho__subtitulo">
            {linha.imovelRotulo} · {linha.clienteNome}
          </p>
        </div>
        <div className="cabecalho__acoes">
          {podeCancelarVenda(usuario, db.permissoes) && podeCancelar(venda) && (
            <button type="button" className="btn btn--contorno-perigo" onClick={() => setDialogo('cancelar')}>
              Cancelar venda
            </button>
          )}
          {podeConcluirEscritura(usuario, db.permissoes) && podeConcluir(venda) && (
            <button type="button" className="btn btn--primario" onClick={() => setDialogo('concluir')}>
              Concluir escritura
            </button>
          )}
          <Link to="/vendas" className="btn btn--secundario">
            Voltar
          </Link>
        </div>
      </header>

      <main className="conteudo pilha">
        <section className="card secao">
          <div className="secao__cabecalho">
            <h2 className="card__titulo">Dados da venda</h2>
            <p className="card__subtitulo">
              {venda.status === 'cancelada'
                ? 'Venda cancelada: não pode ser reaberta nem editada.'
                : 'Cancelamentos exigem justificativa e ficam registrados na auditoria.'}
            </p>
          </div>
          <dl className="ficha">
            <div><dt>Status</dt><dd className="ficha__status"><Badge variante={status.variante}>{status.rotulo}</Badge></dd></div>
            <div><dt>Valor da venda</dt><dd>{formatarMoedaInteira(venda.valor)}</dd></div>
            <div><dt>Data</dt><dd>{formatarData(venda.data)}</dd></div>
            <div><dt>Corretor</dt><dd>{linha.corretorNome}</dd></div>
            <div><dt>Imóvel</dt><dd>{linha.imovel ? <Link to={`/imoveis/${linha.imovel.id}`} className="link">{linha.imovelRotulo}</Link> : linha.imovelRotulo}</dd></div>
            <div><dt>Comprador</dt><dd>{linha.cliente ? <Link to={`/clientes/${linha.cliente.id}`} className="link">{linha.clienteNome}</Link> : linha.clienteNome}</dd></div>
            <div><dt>Proposta de origem</dt><dd>{proposta ? <Link to={`/propostas/${proposta.id}`} className="link">{proposta.codigo}</Link> : '—'}</dd></div>
            <div><dt>Reserva convertida</dt><dd>{reserva ? <Link to={`/reservas/${reserva.id}`} className="link">{reserva.codigo}</Link> : '—'}</dd></div>
          </dl>
          {venda.cancelamento && (
            <p className="nota-regra">
              Cancelada em {dataHora(venda.cancelamento.em)} por {venda.cancelamento.autor}: {venda.cancelamento.justificativa}
            </p>
          )}
        </section>

        <section className="card">
          <div className="card__cabecalho">
            <div>
              <h2 className="card__titulo">Auditoria</h2>
              <p className="card__subtitulo">Registros imutáveis: cada mudança entra no fim da lista · RF32</p>
            </div>
          </div>
          <div className="tabela-wrap">
            <table className="tabela tabela--quebra">
              <thead>
                <tr>
                  <th scope="col">Data e hora</th>
                  <th scope="col">Evento</th>
                  <th scope="col">Responsável</th>
                  <th scope="col">Status</th>
                  <th scope="col">Detalhe</th>
                </tr>
              </thead>
              <tbody>
                {venda.historico.map((e) => (
                  <tr key={e.id}>
                    <td className="tabela__destaque">{dataHora(e.data)}</td>
                    <td>{TITULO_EVENTO[e.tipo]}</td>
                    <td>{e.autor}</td>
                    <td>
                      {e.statusAnterior && `${STATUS_VENDA[e.statusAnterior].rotulo} → `}
                      <Badge variante={STATUS_VENDA[e.status].variante}>{STATUS_VENDA[e.status].rotulo}</Badge>
                    </td>
                    <td>{e.detalhe}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <Dialogo
        aberto={dialogo === 'cancelar'}
        titulo={`Cancelar a venda ${venda.codigo}?`}
        descricao="O status passa a Cancelada e o imóvel fica bloqueado até ser reabilitado. A venda não poderá ser reaberta."
        textoConfirmar={processando ? 'Cancelando…' : 'Cancelar venda'}
        textoCancelar="Voltar"
        perigoso
        carregando={processando}
        onCancelar={fechar}
        onConfirmar={() => executar('cancelar')}
      >
        <Campo rotulo="Justificativa" erro={erroJustificativa} dica={`Obrigatória, com pelo menos ${JUSTIFICATIVA_MINIMA} caracteres.`}>
          {(p) => (
            <textarea
              {...p}
              rows={3}
              aria-required
              className="input input--area"
              placeholder="Ex.: financiamento negado; distrato assinado pelo comprador."
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
            />
          )}
        </Campo>
      </Dialogo>

      <Dialogo
        aberto={dialogo === 'concluir'}
        titulo={`Concluir a escritura da venda ${venda.codigo}?`}
        descricao="O status passa de Em escritura para Concluída e a mudança fica registrada na auditoria."
        textoConfirmar={processando ? 'Concluindo…' : 'Concluir escritura'}
        textoCancelar="Voltar"
        carregando={processando}
        onCancelar={fechar}
        onConfirmar={() => executar('concluir')}
      />
    </>
  )
}
