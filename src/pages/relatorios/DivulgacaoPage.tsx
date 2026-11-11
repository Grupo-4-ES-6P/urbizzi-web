import { History } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { Dialogo } from '../../components/Dialogo'
import { Campo } from '../../components/ui'
import { useToast } from '../../contexts/ToastContext'
import { useDb } from '../../data/db'
import { rotuloImovel } from '../../data/selectors'
import type { Db } from '../../data/types'
import { formatarData } from '../../lib/format'

type Escopo = 'catalogo' | 'loteamento' | 'imovel'

const ESCOPOS: ReadonlyArray<{ valor: Escopo; rotulo: string }> = [
  { valor: 'catalogo', rotulo: 'Catálogo inteiro' },
  { valor: 'loteamento', rotulo: 'Loteamento' },
  { valor: 'imovel', rotulo: 'Imóvel específico' },
]

const VALIDADES = ['Sem expiração', '7 dias', '30 dias', '90 dias'] as const

const DOMINIO = 'urbizzi.com.br'

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

/** Contador estável a partir do alvo (o protótipo ainda não registra acessos reais). */
function visitasDemo(chave: string) {
  let soma = 0
  for (const letra of chave) soma = (soma * 31 + (letra.codePointAt(0) ?? 0)) % 997
  return 40 + (soma % 200)
}

function opcoesAlvo(db: Db, escopo: Escopo) {
  if (escopo === 'loteamento') return db.loteamentos.map((l) => ({ valor: l.id, rotulo: l.nome }))
  if (escopo === 'imovel') return db.imoveis.map((i) => ({ valor: i.id, rotulo: rotuloImovel(i) }))
  return [{ valor: 'todos', rotulo: 'Todos os imóveis publicados' }]
}

/** Endereço público do alvo, usando as rotas do catálogo (/terrenos). */
function enderecoPublico(db: Db, escopo: Escopo, alvo: string) {
  if (escopo === 'imovel') return `${DOMINIO}/terrenos/${alvo}`
  if (escopo === 'loteamento') {
    const nome = db.loteamentos.find((l) => l.id === alvo)?.nome ?? ''
    return `${DOMINIO}/terrenos?emp=${encodeURIComponent(nome)}`
  }
  return `${DOMINIO}/terrenos`
}

function idsNoEscopo(db: Db, escopo: Escopo, alvo: string) {
  if (escopo === 'imovel') return new Set([alvo])
  if (escopo === 'loteamento') {
    const nome = db.loteamentos.find((l) => l.id === alvo)?.nome
    return new Set(db.imoveis.filter((i) => i.loteamento === nome).map((i) => i.id))
  }
  return new Set(db.imoveis.map((i) => i.id))
}

export function DivulgacaoPage() {
  const db = useDb()
  const notificar = useToast()
  const [escopo, setEscopo] = useState<Escopo>('imovel')
  const [alvo, setAlvo] = useState(() => db.imoveis[0]?.id ?? '')
  const [validade, setValidade] = useState<string>(VALIDADES[0])
  const [alertas, setAlertas] = useState<Alerta[]>(() => ALERTAS_PADRAO.map((a) => ({ ...a })))
  const [criadoEm] = useState(() => new Date().toISOString())
  const [historicoAberto, setHistoricoAberto] = useState(false)

  const opcoes = useMemo(() => opcoesAlvo(db, escopo), [db, escopo])
  const endereco = enderecoPublico(db, escopo, alvo)
  const ids = idsNoEscopo(db, escopo, alvo)
  const interesses = db.interesses.filter((i) => ids.has(i.imovelId)).length

  const trocarEscopo = (novo: Escopo) => {
    setEscopo(novo)
    setAlvo(opcoesAlvo(db, novo)[0]?.valor ?? '')
  }

  const alternarAlerta = (id: string) =>
    setAlertas((lista) => lista.map((a) => (a.id === id ? { ...a, ativo: !a.ativo } : a)))

  const salvar = () => notificar('Link e alertas de prazo salvos.')

  return (
    <>
      <header className="cabecalho cabecalho--fixo">
        <div>
          <nav className="migalhas" aria-label="Você está em">
            <Link to="/relatorios">Relatórios</Link>
            <span aria-hidden>›</span>
            <span>Divulgação</span>
          </nav>
          <h1 className="cabecalho__titulo">Divulgação e notificações</h1>
          <p className="cabecalho__subtitulo">Links públicos de consulta e alertas automáticos de prazo · RF22 e RF28</p>
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
        <section className="card secao">
          <div className="secao__cabecalho">
            <h2 className="card__titulo">Gerar link público</h2>
            <p className="card__subtitulo">Endereço de consulta do catálogo inteiro, de um loteamento ou de um imóvel.</p>
          </div>
          <div className="grade">
            <Campo rotulo="Escopo" className="c-3">
              {(p) => (
                <select {...p} className="input select" value={escopo} onChange={(e) => trocarEscopo(e.target.value as Escopo)}>
                  {ESCOPOS.map((s) => <option key={s.valor} value={s.valor}>{s.rotulo}</option>)}
                </select>
              )}
            </Campo>
            <Campo rotulo="Alvo" className="c-6">
              {(p) => (
                <select {...p} className="input select" value={alvo} disabled={escopo === 'catalogo'} onChange={(e) => setAlvo(e.target.value)}>
                  {opcoes.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
                </select>
              )}
            </Campo>
            <Campo rotulo="Validade do link" className="c-3">
              {(p) => (
                <select {...p} className="input select" value={validade} onChange={(e) => setValidade(e.target.value)}>
                  {VALIDADES.map((v) => <option key={v}>{v}</option>)}
                </select>
              )}
            </Campo>
            <Campo
              rotulo="Endereço gerado"
              className="c-6"
              dica="RF31 — se o imóvel sair de Disponível, o link passa a exibir aviso de indisponível em vez dos dados comerciais."
            >
              {(p) => <input {...p} className="input" readOnly value={endereco} />}
            </Campo>
            <Campo rotulo="Visitas" className="c-2">
              {(p) => <input {...p} className="input" readOnly value={visitasDemo(endereco)} />}
            </Campo>
            <Campo rotulo="Interesses recebidos" className="c-2">
              {(p) => <input {...p} className="input" readOnly value={interesses} />}
            </Campo>
            <Campo rotulo="Criado em" className="c-2">
              {(p) => <input {...p} className="input" readOnly value={formatarData(criadoEm)} />}
            </Campo>
          </div>
        </section>

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
