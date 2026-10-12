import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { BotaoTema } from '../components/BotaoTema'
import { BuscaGlobal } from '../components/BuscaGlobal'
import { Dialogo } from '../components/Dialogo'
import { BadgeUrgencia, Campo, Spinner } from '../components/ui'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useDb } from '../data/db'
import { indexar, reservaAtiva, rotuloImovel } from '../data/selectors'
import type { Db, Imovel, Proposta } from '../data/types'
import {
  formatarDataExtensa,
  formatarMoedaCompacta,
  formatarMoedaInteira,
  formatarTempoRestante,
  nomeMes,
  urgenciaReserva,
} from '../lib/format'
import { emAndamento, etapaAtual, formatarPercentual, podeDecidir, situacaoProposta, valorProposta, versaoAtual } from '../lib/propostas'
import { useAgora } from '../lib/useAgora'
import { vendaAtiva } from '../lib/vendas'
import { aprovarProposta, recusarProposta } from '../services/propostas'

const HORA = 3_600_000

const rotuloOuRemovido = (imovel: Imovel | undefined) => (imovel ? rotuloImovel(imovel) : 'Imóvel removido')

const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios)

/** "3 vencem em 48h" ou o texto de vazio quando n = 0. */
function textoContagem(n: number, um: string, varios: string, resto: string, vazio: string) {
  return n ? `${n} ${plural(n, um, varios)} ${resto}` : vazio
}

function textoVariacao(variacao: number | null, mesAnterior: string) {
  if (variacao === null) return `Sem vendas em ${mesAnterior}`
  const sinal = variacao >= 0 ? '+' : ''
  return `${sinal}${variacao}% vs. ${mesAnterior}`
}

function calcularIndicadores(db: Db, agora: number, usuarioId: string | undefined) {
  const data = new Date(agora)
  const inicioMes = new Date(data.getFullYear(), data.getMonth(), 1).getTime()
  const inicioMesAnterior = new Date(data.getFullYear(), data.getMonth() - 1, 1).getTime()

  const publicados = db.imoveis.filter((i) => i.status === 'publicado')
  const disponiveis = publicados.filter((i) => i.situacao === 'disponivel')
  const novosNoMes = disponiveis.filter((i) => new Date(i.criadoEm).getTime() >= inicioMes).length

  const ativas = db.reservas.filter((r) => reservaAtiva(r, agora))
  const vencem48h = ativas.filter((r) => new Date(r.expiraEm).getTime() - agora <= 48 * HORA).length

  const pendentes = db.propostas.filter((p) => emAndamento(situacaoProposta(p, agora)))
  // Só as propostas cuja etapa atual depende do usuário logado.
  const aguardandoAdmin = pendentes.filter((p) => podeDecidir(p, usuarioId, agora))

  const somaEntre = (de: number, ate: number) =>
    db.vendas
      .filter((v) => {
        const t = new Date(v.data).getTime()
        return vendaAtiva(v) && t >= de && t < ate
      })
      .reduce((s, v) => s + v.valor, 0)
  const vendasMes = somaEntre(inicioMes, Infinity)
  const vendasMesAnterior = somaEntre(inicioMesAnterior, inicioMes)
  const variacao = vendasMesAnterior ? Math.round(((vendasMes - vendasMesAnterior) / vendasMesAnterior) * 100) : null

  return {
    disponiveis: disponiveis.length,
    novosNoMes,
    reservasAtivas: ativas.length,
    vencem48h,
    pendentes: pendentes.length,
    aguardandoAdmin,
    vendasMes,
    variacao,
    mesAnterior: nomeMes(new Date(inicioMesAnterior)),
  }
}

export function DashboardPage() {
  const db = useDb()
  const agora = useAgora()
  const navigate = useNavigate()
  const { usuario } = useAuth()

  const imoveisPorId = useMemo(() => indexar(db.imoveis), [db.imoveis])
  const pessoas = useMemo(() => indexar([...db.clientes, ...db.corretores]), [db.clientes, db.corretores])

  const indicadores = useMemo(() => calcularIndicadores(db, agora, usuario?.id), [db, agora, usuario?.id])

  const proximasReservas = useMemo(
    () =>
      db.reservas
        .filter((r) => reservaAtiva(r, agora))
        .sort((a, b) => a.expiraEm.localeCompare(b.expiraEm))
        .slice(0, 5),
    [db.reservas, agora],
  )

  const propostasDestaque = [...indicadores.aguardandoAdmin]
    .sort((a, b) => a.criadaEm.localeCompare(b.criadaEm))
    .slice(0, 3)

  return (
    <>
      <header className="cabecalho">
        <div>
          <h1 className="cabecalho__titulo">Dashboard</h1>
          <p className="cabecalho__subtitulo">{formatarDataExtensa(new Date(agora))}</p>
        </div>
        <div className="cabecalho__acoes">
          <BuscaGlobal />
          <button type="button" className="btn btn--primario" onClick={() => navigate('/imoveis/novo')}>
            <Plus size={16} /> Novo imóvel
          </button>
          <BotaoTema />
        </div>
      </header>

      <main className="conteudo">
        <section className="kpis" aria-label="Indicadores">
          <Kpi
            titulo="Imóveis disponíveis"
            valor={indicadores.disponiveis}
            detalhe={`+${indicadores.novosNoMes} este mês`}
            tom="positivo"
            para="/imoveis?situacao=disponivel"
          />
          <Kpi
            titulo="Reservas ativas"
            valor={indicadores.reservasAtivas}
            detalhe={textoContagem(indicadores.vencem48h, 'vence', 'vencem', 'em 48h', 'Nenhuma vence em 48h')}
            tom={indicadores.vencem48h ? 'alerta' : 'neutro'}
            para="/reservas"
          />
          <Kpi
            titulo="Propostas pendentes"
            valor={indicadores.pendentes}
            detalhe={textoContagem(indicadores.aguardandoAdmin.length, 'aguarda', 'aguardam', 'você', 'Nenhuma aguarda você')}
            tom="neutro"
            para="/propostas"
          />
          <Kpi
            titulo="Vendas no mês"
            valor={formatarMoedaCompacta(indicadores.vendasMes)}
            detalhe={textoVariacao(indicadores.variacao, indicadores.mesAnterior)}
            tom={(indicadores.variacao ?? 0) < 0 ? 'negativo' : 'positivo'}
            para="/vendas"
          />
        </section>

        <div className="dashboard__grade">
          <section className="card" aria-labelledby="titulo-reservas">
            <div className="card__cabecalho">
              <div>
                <h2 id="titulo-reservas" className="card__titulo">
                  Reservas próximas do vencimento
                </h2>
                <p className="card__subtitulo">Expiram automaticamente se não houver proposta</p>
              </div>
              <Link to="/reservas" className="link">
                Ver todos
              </Link>
            </div>
            {proximasReservas.length === 0 ? (
              <p className="card__vazio">Nenhuma reserva ativa no momento.</p>
            ) : (
              <div className="tabela-wrap">
                <table className="tabela">
                  <thead>
                    <tr>
                      <th>Imóvel</th>
                      <th>Cliente</th>
                      <th>Corretor</th>
                      <th>Expira em</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proximasReservas.map((r) => {
                      const imovel = imoveisPorId.get(r.imovelId)
                      const restante = new Date(r.expiraEm).getTime() - agora
                      return (
                        <tr key={r.id}>
                          <td className="tabela__destaque">
                            {imovel ? <Link to={`/imoveis/${imovel.id}`}>{rotuloImovel(imovel)}</Link> : '—'}
                          </td>
                          <td>{pessoas.get(r.clienteId)?.nome ?? '—'}</td>
                          <td>{pessoas.get(r.corretorId)?.nome ?? '—'}</td>
                          <td>
                            <time dateTime={r.expiraEm} title={new Date(r.expiraEm).toLocaleString('pt-BR')}>
                              {formatarTempoRestante(restante)}
                            </time>
                          </td>
                          <td>
                            <BadgeUrgencia urgencia={urgenciaReserva(restante)} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card" aria-labelledby="titulo-propostas">
            <div className="card__cabecalho">
              <div>
                <h2 id="titulo-propostas" className="card__titulo">
                  Propostas aguardando aprovação
                </h2>
                <p className="card__subtitulo">
                  {textoContagem(indicadores.aguardandoAdmin.length, 'exige', 'exigem', 'sua análise', 'Nenhuma exige sua análise')}
                </p>
              </div>
              <Link to="/propostas" className="link">
                Ver todos
              </Link>
            </div>
            {propostasDestaque.length === 0 ? (
              <p className="card__vazio">Tudo em dia! Nenhuma proposta aguarda a sua decisão.</p>
            ) : (
              <ul className="propostas">
                {propostasDestaque.map((p) => (
                  <ItemProposta
                    key={p.id}
                    proposta={p}
                    rotulo={rotuloOuRemovido(imoveisPorId.get(p.imovelId))}
                    cliente={pessoas.get(p.clienteId)?.nome ?? 'Cliente'}
                    detalhe={`${etapaAtual(p)?.titulo ?? 'Aprovação'} · desconto de ${formatarPercentual(versaoAtual(p).condicoes.descontoPercentual)}`}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </>
  )
}

interface KpiProps {
  titulo: string
  valor: number | string
  detalhe: string
  tom: 'positivo' | 'alerta' | 'negativo' | 'neutro'
  para: string
}

function Kpi({ titulo, valor, detalhe, tom, para }: Readonly<KpiProps>) {
  return (
    <Link to={para} className="card kpi">
      <span className="kpi__titulo">{titulo}</span>
      <strong className="kpi__valor">{valor}</strong>
      <span className={`kpi__detalhe kpi__detalhe--${tom}`}>{detalhe}</span>
    </Link>
  )
}

interface ItemPropostaProps {
  proposta: Proposta
  rotulo: string
  cliente: string
  detalhe: string
}

function ItemProposta({ proposta, rotulo, cliente, detalhe }: Readonly<ItemPropostaProps>) {
  const notificar = useToast()
  const { usuario } = useAuth()
  const [acao, setAcao] = useState<'aprovar' | 'recusar' | null>(null)
  const [confirmarRecusa, setConfirmarRecusa] = useState(false)
  const [motivo, setMotivo] = useState('')
  const valor = valorProposta(proposta)
  const decisor = { id: usuario?.id ?? '', nome: usuario?.nome ?? 'Administrador' }

  const executar = async (tipo: 'aprovar' | 'recusar') => {
    setAcao(tipo)
    try {
      if (tipo === 'aprovar') {
        const { proposta: aprovada, codigoVenda } = await aprovarProposta(proposta.id, decisor)
        notificar(
          codigoVenda
            ? `Proposta de ${cliente} aprovada. Venda de ${formatarMoedaInteira(valor)} registrada.`
            : `Etapa aprovada. A proposta de ${cliente} segue para ${etapaAtual(aprovada)?.titulo.toLowerCase() ?? 'a próxima etapa'}.`,
        )
      } else {
        await recusarProposta(proposta.id, motivo, decisor)
        notificar(`Proposta de ${cliente} recusada.`, 'info')
      }
    } catch (error_) {
      notificar(error_ instanceof Error ? error_.message : 'Não foi possível concluir a ação.', 'erro')
      setAcao(null)
    }
    setConfirmarRecusa(false)
  }

  return (
    <li className="proposta">
      <Link to={`/propostas/${proposta.id}`} className="proposta__imovel">
        {rotulo}
      </Link>
      <span className="proposta__detalhe">
        {cliente} · {detalhe}
      </span>
      <div className="proposta__rodape">
        <strong className="proposta__valor">{formatarMoedaInteira(valor)}</strong>
        <div className="proposta__acoes">
          <button
            type="button"
            className="btn btn--secundario btn--pequeno"
            disabled={acao !== null}
            onClick={() => setConfirmarRecusa(true)}
            aria-label={`Recusar proposta de ${cliente} para ${rotulo}`}
          >
            Recusar
          </button>
          <button
            type="button"
            className="btn btn--primario btn--pequeno"
            disabled={acao !== null}
            onClick={() => executar('aprovar')}
            aria-label={`Aprovar proposta de ${cliente} para ${rotulo}`}
          >
            {acao === 'aprovar' ? <Spinner tamanho={12} /> : 'Aprovar'}
          </button>
        </div>
      </div>
      <Dialogo
        aberto={confirmarRecusa}
        titulo="Recusar proposta?"
        descricao={
          <>
            {cliente} ofereceu <strong>{formatarMoedaInteira(valor)}</strong> por {rotulo}. O corretor será
            avisado da recusa.
          </>
        }
        textoConfirmar={acao === 'recusar' ? 'Recusando…' : 'Recusar proposta'}
        perigoso
        carregando={acao === 'recusar'}
        confirmarDesabilitado={!motivo.trim()}
        onCancelar={() => setConfirmarRecusa(false)}
        onConfirmar={() => executar('recusar')}
      >
        <Campo rotulo="Motivo da recusa" dica="Obrigatório; fica registrado no histórico da proposta.">
          {(props) => (
            <textarea
              {...props}
              className="input input--area"
              rows={3}
              placeholder="Ex.: valor abaixo do mínimo aceito"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          )}
        </Campo>
      </Dialogo>
    </li>
  )
}
