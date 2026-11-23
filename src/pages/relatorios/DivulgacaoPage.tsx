import { Bell, History } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { Dialogo } from '../../components/Dialogo'
import { Spinner } from '../../components/ui'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import {
  ANTECEDENCIAS,
  listarConfig,
  listarEnvios,
  salvarConfig,
  type ConfigAlerta,
  type Envio,
} from '../../services/configNotificacoes'

const quando = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export function DivulgacaoPage() {
  const notificar = useToast()
  const { pode } = useAuth()
  const editavel = pode('GERENCIAR_USUARIOS')
  const [salvos, setSalvos] = useState<ConfigAlerta[] | null>(null)
  const [alertas, setAlertas] = useState<ConfigAlerta[]>([])
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [envios, setEnvios] = useState<Envio[] | null>(null)

  useEffect(() => {
    listarConfig()
      .then((lista) => {
        setSalvos(lista)
        setAlertas(lista)
      })
      .catch((error_: unknown) => setErro(error_ instanceof Error ? error_.message : 'Não foi possível carregar os alertas.'))
  }, [])

  const alterar = (tipo: string, mudanca: Partial<ConfigAlerta>) =>
    setAlertas((lista) => lista.map((a) => (a.tipo === tipo ? { ...a, ...mudanca } : a)))

  const alterados = alertas.filter((a) => {
    const s = salvos?.find((x) => x.tipo === a.tipo)
    return s && (s.ativo !== a.ativo || s.email !== a.email || s.antecedenciaHoras !== a.antecedenciaHoras)
  })

  const salvar = async () => {
    setSalvando(true)
    try {
      for (const a of alterados) await salvarConfig(a)
      setSalvos(alertas)
      notificar('Alertas de prazo salvos.')
    } catch (error_) {
      notificar(error_ instanceof Error ? error_.message : 'Não foi possível salvar.', 'erro')
    } finally {
      setSalvando(false)
    }
  }

  const abrirHistorico = async () => {
    try {
      setEnvios(await listarEnvios())
    } catch (error_) {
      notificar(error_ instanceof Error ? error_.message : 'Não foi possível carregar o histórico.', 'erro')
    }
  }

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
          {editavel && (
            <>
              <button type="button" className="btn btn--secundario" onClick={abrirHistorico}>
                <History size={15} /> Histórico de envios
              </button>
              <button type="button" className="btn btn--primario" onClick={salvar} disabled={salvando || alterados.length === 0}>
                {salvando ? <Spinner /> : null} Salvar
              </button>
            </>
          )}
        </div>
      </header>

      <main className="conteudo pilha">
        <section className="card">
          <div className="card__cabecalho">
            <div>
              <h2 className="card__titulo">Alertas de prazo</h2>
              <p className="card__subtitulo">
                Disparados pelo sistema a partir das datas-limite; nenhum prazo depende de conferência manual.
                {!editavel && ' Só administradores alteram estes alertas.'}
              </p>
            </div>
          </div>
          {erro && (
            <div className="alerta alerta--erro" role="alert">
              {erro}
            </div>
          )}
          {!salvos && !erro && <Spinner />}
          {salvos && (
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
                  {alertas.map((a) => (
                    <tr key={a.tipo}>
                      <td className="tabela__destaque">{a.evento}</td>
                      <td>
                        {a.antecedenciaHoras === null ? (
                          a.quando
                        ) : (
                          <select
                            className="input select"
                            aria-label={`Antecedência: ${a.evento}`}
                            value={a.antecedenciaHoras}
                            disabled={!editavel}
                            onChange={(e) => alterar(a.tipo, { antecedenciaHoras: Number(e.target.value) })}
                          >
                            {ANTECEDENCIAS.map((h) => (
                              <option key={h} value={h}>
                                {h} h antes do prazo
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td>{a.destinatario}</td>
                      <td>
                        <label className="checkbox">
                          <input
                            type="checkbox"
                            checked={a.email}
                            disabled={!editavel}
                            onChange={(e) => alterar(a.tipo, { email: e.target.checked })}
                            aria-label={`Também por e-mail: ${a.evento}`}
                          />
                          <span>Painel{a.email ? ' + e-mail' : ''}</span>
                        </label>
                      </td>
                      <td>
                        <button
                          type="button"
                          className={`badge badge--${a.ativo ? 'normal' : 'escuro'}`}
                          aria-pressed={a.ativo}
                          aria-label={`${a.evento}: ${a.ativo ? 'ativo' : 'inativo'}`}
                          disabled={!editavel}
                          onClick={() => alterar(a.tipo, { ativo: !a.ativo })}
                        >
                          {a.ativo ? 'Ativo' : 'Inativo'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      <Dialogo
        aberto={envios !== null}
        titulo="Histórico de envios"
        textoConfirmar="Fechar"
        semCancelar
        largo
        onConfirmar={() => setEnvios(null)}
        onCancelar={() => setEnvios(null)}
      >
        {envios?.length === 0 ? (
          <p className="card__vazio">Nenhum aviso enviado ainda.</p>
        ) : (
          <div className="tabela-wrap">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Aviso</th>
                  <th>Destinatário</th>
                  <th>Lido</th>
                </tr>
              </thead>
              <tbody>
                {envios?.map((h) => (
                  <tr key={h.id}>
                    <td>{quando(h.criadaEm)}</td>
                    <td>{h.titulo}</td>
                    <td>{h.destinatario}</td>
                    <td>{h.lida ? 'Sim' : 'Não'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Dialogo>
    </>
  )
}
