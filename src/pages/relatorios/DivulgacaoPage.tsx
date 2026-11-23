import { History } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { Dialogo } from '../../components/Dialogo'
import { useToast } from '../../contexts/ToastContext'
import { formatarData } from '../../lib/format'

interface Alerta {
  id: string
  evento: string
  antecedencia: string
  canal: string
  destinatario: string
  ativo: boolean
}

const ALERTAS_PADRAO: readonly Alerta[] = [
  { id: 'reserva-vencer', evento: 'Reserva a vencer', antecedencia: '48h antes', canal: 'E-mail + painel', destinatario: 'Responsável comercial', ativo: true },
  { id: 'reserva-expirada', evento: 'Reserva expirada', antecedencia: 'No vencimento', canal: 'E-mail + painel', destinatario: 'Responsável e gestor', ativo: true },
  { id: 'proposta-expirar', evento: 'Proposta a expirar', antecedencia: '3 dias antes', canal: 'E-mail', destinatario: 'Vendedor e aprovador', ativo: true },
  { id: 'proposta-expirada', evento: 'Proposta expirada', antecedencia: 'No vencimento', canal: 'Painel', destinatario: 'Vendedor', ativo: true },
  { id: 'licenca-vencer', evento: 'Licença do loteamento a vencer', antecedencia: '60 dias antes', canal: 'E-mail', destinatario: 'Administrador', ativo: false },
]

const HISTORICO_ENVIOS: ReadonlyArray<{ id: string; data: string; evento: string; canal: string; destinatario: string }> = [
  { id: 'env-1', data: '2026-11-05', evento: 'Reserva a vencer', canal: 'E-mail + painel', destinatario: 'Responsável comercial' },
  { id: 'env-2', data: '2026-11-04', evento: 'Proposta a expirar', canal: 'E-mail', destinatario: 'Vendedor e aprovador' },
  { id: 'env-3', data: '2026-11-03', evento: 'Reserva expirada', canal: 'E-mail + painel', destinatario: 'Responsável e gestor' },
  { id: 'env-4', data: '2026-11-01', evento: 'Proposta expirada', canal: 'Painel', destinatario: 'Vendedor' },
]

export function DivulgacaoPage() {
  const notificar = useToast()
  const [alertas, setAlertas] = useState<Alerta[]>(() => ALERTAS_PADRAO.map((a) => ({ ...a })))
  const [historicoAberto, setHistoricoAberto] = useState(false)

  const alternarAlerta = (id: string) =>
    setAlertas((lista) => lista.map((a) => (a.id === id ? { ...a, ativo: !a.ativo } : a)))

  const salvar = () => notificar('Alertas de prazo salvos.')

  return (
    <>
      <header className="cabecalho cabecalho--fixo">
        <div>
          <nav className="migalhas" aria-label="Você está em">
            <Link to="/relatorios">Relatórios</Link>
            <span aria-hidden>›</span>
            <span>Notificações</span>
          </nav>
          <h1 className="cabecalho__titulo">Configurar notificações</h1>
          <p className="cabecalho__subtitulo">Alertas automáticos de prazo · RF28</p>
        </div>
        <div className="cabecalho__acoes">
          <button type="button" className="btn btn--secundario" onClick={() => setHistoricoAberto(true)}>
            <History size={15} /> Histórico de envios
          </button>
          <button type="button" className="btn btn--primario" onClick={salvar}>
            Salvar
          </button>
        </div>
      </header>

      <main className="conteudo pilha">
        <section className="card">
          <div className="card__cabecalho">
            <div>
              <h2 className="card__titulo">Alertas de prazo</h2>
              <p className="card__subtitulo">Disparados pelo sistema a partir das datas-limite; nenhum prazo depende de conferência manual.</p>
            </div>
          </div>
          <div className="tabela-wrap">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Evento</th><th>Antecedência</th><th>Canal</th><th>Destinatário</th><th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {alertas.map((a) => (
                  <tr key={a.id}>
                    <td className="tabela__destaque">{a.evento}</td>
                    <td>{a.antecedencia}</td>
                    <td>{a.canal}</td>
                    <td>{a.destinatario}</td>
                    <td>
                      <button
                        type="button"
                        className={`badge badge--${a.ativo ? 'normal' : 'escuro'}`}
                        aria-pressed={a.ativo}
                        aria-label={`${a.evento}: ${a.ativo ? 'ativo' : 'inativo'}`}
                        title={a.ativo ? 'Clique para desativar' : 'Clique para ativar'}
                        onClick={() => alternarAlerta(a.id)}
                      >
                        {a.ativo ? 'Ativo' : 'Inativo'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <Dialogo
        aberto={historicoAberto}
        titulo="Histórico de envios"
        textoConfirmar="Fechar"
        semCancelar
        largo
        onConfirmar={() => setHistoricoAberto(false)}
        onCancelar={() => setHistoricoAberto(false)}
      >
        <div className="tabela-wrap">
          <table className="tabela">
            <thead>
              <tr>
                <th>Data</th><th>Evento</th><th>Canal</th><th>Destinatário</th>
              </tr>
            </thead>
            <tbody>
              {HISTORICO_ENVIOS.map((h) => (
                <tr key={h.id}>
                  <td>{formatarData(h.data)}</td>
                  <td>{h.evento}</td>
                  <td>{h.canal}</td>
                  <td>{h.destinatario}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Dialogo>
    </>
  )
}
