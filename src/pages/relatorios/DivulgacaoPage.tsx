import { Bell } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge } from '../../components/ui'

interface Alerta {
  evento: string
  quando: string
  destinatario: string
  canal: string
}

/** Espelha o que a API dispara hoje (módulo notificacoes e prazo de proposta). */
const ALERTAS: readonly Alerta[] = [
  {
    evento: 'Reserva perto de vencer',
    quando: '48 h antes do prazo da proposta pendente',
    destinatario: 'Corretor da proposta e quem aprova propostas',
    canal: 'Painel',
  },
  {
    evento: 'Reserva expirada',
    quando: 'No vencimento: a proposta é recusada e o lote volta a disponível',
    destinatario: 'Automático (registrado na proposta)',
    canal: 'Painel',
  },
  { evento: 'Proposta aguardando análise', quando: 'Ao enviar a proposta', destinatario: 'Quem aprova propostas', canal: 'Painel' },
  { evento: 'Proposta aprovada ou recusada', quando: 'Na decisão', destinatario: 'Corretor da proposta', canal: 'Painel' },
  { evento: 'Novo interesse pelo site', quando: 'Ao receber o formulário do catálogo', destinatario: 'Quem cria propostas', canal: 'Painel' },
]

export function DivulgacaoPage() {
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
          <Link to="/notificacoes" className="btn btn--secundario">
            <Bell size={15} /> Minhas notificações
          </Link>
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
                  <th>Evento</th>
                  <th>Quando</th>
                  <th>Destinatário</th>
                  <th>Canal</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {ALERTAS.map((a) => (
                  <tr key={a.evento}>
                    <td className="tabela__destaque">{a.evento}</td>
                    <td>{a.quando}</td>
                    <td>{a.destinatario}</td>
                    <td>{a.canal}</td>
                    <td>
                      <Badge variante="normal">Ativo</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  )
}
