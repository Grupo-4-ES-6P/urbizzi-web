import { BadgeCheck, Bell, CalendarClock, CalendarX, CheckCheck, FileText, MessageSquare, XCircle } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Spinner } from '../components/ui'
import { useToast } from '../contexts/ToastContext'
import { marcarComoLida, marcarTodasComoLidas, useNotificacoes, type Notificacao } from '../services/notificacoes'

const ICONES: Record<string, typeof Bell> = {
  interesse: MessageSquare,
  proposta_pendente: FileText,
  proposta_aprovada: BadgeCheck,
  proposta_recusada: XCircle,
  reserva_vencendo: CalendarClock,
  reserva_expirada: CalendarX,
}

function quando(iso: string, agora = Date.now()) {
  const minutos = Math.round((agora - new Date(iso).getTime()) / 60_000)
  if (minutos < 1) return 'agora'
  if (minutos < 60) return `há ${minutos} min`
  if (minutos < 24 * 60) return `há ${Math.round(minutos / 60)} h`
  return new Date(iso).toLocaleDateString('pt-BR')
}

export function NotificacoesPage() {
  const { dados, erro } = useNotificacoes()
  const notificar = useToast()
  const navigate = useNavigate()
  const [soNaoLidas, setSoNaoLidas] = useState(false)

  const itens = (dados?.itens ?? []).filter((n) => !soNaoLidas || !n.lida)

  const abrir = async (n: Notificacao) => {
    try {
      if (!n.lida) await marcarComoLida(n.id)
    } catch {
      // Abrir o link importa mais que marcar.
    }
    if (n.link) navigate(n.link)
  }

  const lerTodas = async () => {
    try {
      await marcarTodasComoLidas()
    } catch (error_) {
      notificar(error_ instanceof Error ? error_.message : 'Não foi possível marcar como lidas.', 'erro')
    }
  }

  return (
    <>
      <header className="cabecalho">
        <div>
          <h1 className="cabecalho__titulo">Notificações</h1>
          <p className="cabecalho__subtitulo">
            {dados ? `${dados.naoLidas} não ${dados.naoLidas === 1 ? 'lida' : 'lidas'}` : 'Carregando…'}
          </p>
        </div>
        <div className="cabecalho__acoes">
          <label className="checkbox">
            <input type="checkbox" checked={soNaoLidas} onChange={(e) => setSoNaoLidas(e.target.checked)} />
            <span>Só não lidas</span>
          </label>
          <button type="button" className="btn btn--secundario" disabled={!dados?.naoLidas} onClick={lerTodas}>
            <CheckCheck size={15} /> Marcar todas como lidas
          </button>
        </div>
      </header>

      <main className="conteudo">
        <section className="card">
          {erro && (
            <div className="alerta alerta--erro" role="alert">
              {erro}
            </div>
          )}
          {!dados && !erro && <Spinner />}
          {dados && itens.length === 0 && (
            <p className="card__vazio">{soNaoLidas ? 'Nenhuma notificação não lida.' : 'Nenhuma notificação por enquanto.'}</p>
          )}
          {itens.length > 0 && (
            <ul className="notificacoes">
              {itens.map((n) => {
                const Icone = ICONES[n.tipo] ?? Bell
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      className={`notificacao ${n.lida ? '' : 'notificacao--nova'}`}
                      onClick={() => void abrir(n)}
                    >
                      <Icone size={18} aria-hidden />
                      <span className="notificacao__texto">
                        <strong>{n.titulo}</strong>
                        <span>{n.mensagem}</span>
                      </span>
                      <time dateTime={n.criadaEm}>{quando(n.criadaEm)}</time>
                      {!n.lida && <span className="sr-only">(não lida)</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </main>
    </>
  )
}
