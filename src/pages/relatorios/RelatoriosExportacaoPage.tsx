import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { Dialogo } from '../../components/Dialogo'
import { Badge, Campo } from '../../components/ui'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useDb } from '../../data/db'
import type { Db } from '../../data/types'
import { dataCalendario, formatarData, formatarMoedaAbreviada } from '../../lib/format'
import { reservasDe } from '../../data/selectors'
import { baixarCsv, gerarCsv } from '../../lib/csv'
import { imprimirTabela, montarRelatorio, TIPOS_RELATORIO, type TipoRelatorio } from '../../lib/relatorios'

type Formato = 'PDF' | 'CSV'
type StatusRelatorio = 'pronto' | 'gerando'

interface RelatorioGerado {
  id: string
  nome: string
  periodo: string
  formato: Formato
  geradoPor: string
  data: string
  status: StatusRelatorio
}

const DIAS_DISPONIVEL = 90


const FORMATOS: readonly Formato[] = ['PDF', 'CSV']

const STATUS: Record<StatusRelatorio, { rotulo: string; variante: string }> = {
  pronto: { rotulo: 'Pronto', variante: 'normal' },
  gerando: { rotulo: 'Gerando', variante: 'laranja' },
}


const DIA_MS = 24 * 60 * 60 * 1000

/** Indicadores do ano corrente calculados a partir das vendas e reservas cadastradas. */
function indicadores(db: Db, ano: number) {
  const doAno = (data: string) => new Date(data).getFullYear() === ano
  const vendas = db.vendas.filter((v) => v.status === 'ativa' && doAno(v.data))
  const total = vendas.reduce((s, v) => s + v.valor, 0)
  const ticket = vendas.length ? total / vendas.length : 0

  const anteriores = db.vendas.filter((v) => v.status === 'ativa' && new Date(v.data).getFullYear() === ano - 1)
  const ticketAnterior = anteriores.length ? anteriores.reduce((s, v) => s + v.valor, 0) / anteriores.length : 0
  const variacao = ticketAnterior ? Math.round(((ticket - ticketAnterior) / ticketAnterior) * 100) : null

  // Só entram reservas já encerradas: convertidas, canceladas ou com prazo vencido.
  const agora = Date.now()
  const encerradas = reservasDe(db).filter(
    (r) => doAno(r.criadaEm) && (r.status !== 'ativa' || new Date(r.expiraEm).getTime() < agora),
  )
  const convertidas = encerradas.filter((r) => r.status === 'convertida').length
  const conversao = encerradas.length ? Math.round((convertidas / encerradas.length) * 100) : null

  const prazos = vendas.flatMap((v) => {
    const reserva = reservasDe(db).find((r) => r.imovelId === v.imovelId && r.status === 'convertida')
    if (!reserva) return []
    const dias = (new Date(v.data).getTime() - new Date(reserva.criadaEm).getTime()) / DIA_MS
    return dias >= 0 ? [dias] : []
  })
  const tempoMedio = prazos.length ? Math.round(prazos.reduce((s, d) => s + d, 0) / prazos.length) : null

  return { total, contratos: vendas.length, ticket, variacao, conversao, tempoMedio }
}

function textoVariacao(variacao: number | null, ano: number) {
  if (variacao === null) return 'média por contrato'
  const sinal = variacao > 0 ? '+' : ''
  return `${sinal}${variacao}% vs. ${ano - 1}`
}

export function RelatoriosExportacaoPage() {
  const db = useDb()
  const { usuario } = useAuth()
  const notificar = useToast()
  const ano = new Date().getFullYear()
  const k = indicadores(db, ano)

  const [relatorios, setRelatorios] = useState<RelatorioGerado[]>([])
  const [gerarAberto, setGerarAberto] = useState(false)
  const [tipo, setTipo] = useState<TipoRelatorio>(TIPOS_RELATORIO[0])
  const [periodo, setPeriodo] = useState(String(ano))
  const [formato, setFormato] = useState<Formato>('PDF')

  const gerar = () => {
    const anoFiltro = /^\d{4}$/.test(periodo.trim()) ? Number(periodo.trim()) : null
    const tabela = montarRelatorio(db, tipo, anoFiltro)
    const rotuloPeriodo = periodo.trim() || 'Todo o histórico'
    try {
      if (formato === 'CSV') {
        baixarCsv(`${tipo.toLowerCase().replaceAll(' ', '-')}-${rotuloPeriodo}.csv`, gerarCsv(tabela.cabecalho, tabela.linhas))
      } else {
        imprimirTabela(tipo, `Período: ${rotuloPeriodo} · ${tabela.linhas.length} registro(s)`, tabela)
      }
    } catch (error_) {
      notificar(error_ instanceof Error ? error_.message : 'Não foi possível gerar o relatório.', 'erro')
      return
    }
    const novo: RelatorioGerado = {
      id: crypto.randomUUID(),
      nome: tipo,
      periodo: rotuloPeriodo,
      formato,
      geradoPor: usuario?.nome ?? 'Administrador',
      data: dataCalendario(new Date()),
      status: 'pronto',
    }
    setRelatorios((lista) => [novo, ...lista])
    setGerarAberto(false)
    notificar(`Relatório "${tipo}" gerado em ${formato} com ${tabela.linhas.length} registro(s).`)
  }

  return (
    <>
      <header className="cabecalho">
        <div>
          <h1 className="cabecalho__titulo">Relatórios</h1>
          <p className="cabecalho__subtitulo">Histórico consolidado do período · exportação em CSV e PDF</p>
        </div>
        <div className="cabecalho__acoes">
          <Link to="/relatorios/notificacoes" className="btn btn--secundario">
            Configurar notificações
          </Link>
          <button type="button" className="btn btn--primario" onClick={() => setGerarAberto(true)}>
            <Plus size={16} aria-hidden /> Gerar relatório
          </button>
        </div>
      </header>

      <main className="conteudo">
        <section className="kpis" aria-label="Indicadores do período">
          <article className="card kpi">
            <span className="kpi__titulo">Vendas no período</span>
            <strong className="kpi__valor">{formatarMoedaAbreviada(k.total)}</strong>
            <span className="kpi__detalhe kpi__detalhe--laranja">
              {k.contratos} {k.contratos === 1 ? 'contrato fechado' : 'contratos fechados'}
            </span>
          </article>
          <article className="card kpi">
            <span className="kpi__titulo">Ticket médio</span>
            <strong className="kpi__valor">{formatarMoedaAbreviada(k.ticket)}</strong>
            <span className="kpi__detalhe kpi__detalhe--laranja">{textoVariacao(k.variacao, ano)}</span>
          </article>
          <article className="card kpi">
            <span className="kpi__titulo">Conversão de reservas</span>
            <strong className="kpi__valor">{k.conversao === null ? '—' : `${k.conversao}%`}</strong>
            <span className="kpi__detalhe kpi__detalhe--laranja">
              {k.conversao === null ? 'nenhuma reserva encerrada ainda' : 'reservas que viraram venda'}
            </span>
          </article>
          <article className="card kpi">
            <span className="kpi__titulo">Tempo médio de venda</span>
            <strong className="kpi__valor">{k.tempoMedio === null ? '—' : `${k.tempoMedio} dias`}</strong>
            <span className="kpi__detalhe kpi__detalhe--laranja">da reserva à escritura</span>
          </article>
        </section>

        <section className="card">
          <div className="card__cabecalho">
            <div>
              <h2 className="card__titulo">Relatórios gerados</h2>
              <p className="card__subtitulo">Arquivos ficam disponíveis por {DIAS_DISPONIVEL} dias</p>
            </div>
          </div>
          <div className="tabela-wrap">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Relatório</th><th>Período</th><th>Formato</th><th>Gerado por</th><th>Data</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {relatorios.length === 0 && (
                  <tr>
                    <td colSpan={6} className="card__vazio">
                      Nenhum relatório gerado nesta sessão. Use “Gerar relatório” para baixar CSV ou imprimir em PDF.
                    </td>
                  </tr>
                )}
                {relatorios.map((r) => (
                  <tr key={r.id}>
                    <td className="tabela__destaque">{r.nome}</td>
                    <td>{r.periodo}</td>
                    <td>{r.formato}</td>
                    <td>{r.geradoPor}</td>
                    <td>{formatarData(r.data)}</td>
                    <td><Badge variante={STATUS[r.status].variante}>{STATUS[r.status].rotulo}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <Dialogo
        aberto={gerarAberto}
        titulo="Gerar relatório"
        textoConfirmar="Gerar"
        onConfirmar={gerar}
        onCancelar={() => setGerarAberto(false)}
      >
        <div className="grade">
          <Campo rotulo="Relatório" className="c-6">
            {(p) => (
              <select {...p} className="input select" value={tipo} onChange={(e) => setTipo(e.target.value as TipoRelatorio)}>
                {TIPOS_RELATORIO.map((t) => <option key={t}>{t}</option>)}
              </select>
            )}
          </Campo>
          <Campo rotulo="Período" className="c-3">
            {(p) => <input {...p} className="input" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />}
          </Campo>
          <Campo rotulo="Formato" className="c-3">
            {(p) => (
              <select {...p} className="input select" value={formato} onChange={(e) => setFormato(e.target.value as Formato)}>
                {FORMATOS.map((f) => <option key={f}>{f}</option>)}
              </select>
            )}
          </Campo>
        </div>
      </Dialogo>
    </>
  )
}
