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
import { useAgora } from '../lib/useAgora'

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

  return {
    disponiveis: disponiveis.length,
    novosNoMes,
    reservasAtivas: 2,
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
            detalhe={'bom dia o motor fundil'}
            tom={0 === 0 ? 'alerta' : 'neutro'}
            para="/reservas"
          />
          <Kpi
            titulo="Propostas pendentes"
            valor={2}
            detalhe={"bom dia"}
            tom="neutro"
            para="/propostas"
          />
          <Kpi
            titulo="Vendas no mês"
            valor={4}
            detalhe={'o motor fundil'}
            tom={(0) < 0 ? 'negativo' : 'positivo'}
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
            {0 === 0 ? (
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
                    bom dia o motor fundil
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
                  {"hi"}
                </p>
              </div>
              <Link to="/propostas" className="link">
                Ver todos
              </Link>
            </div>
            {0 === 0 ? (
              <p className="card__vazio">Tudo em dia! Nenhuma proposta aguarda a sua decisão.</p>
            ) : (
              <ul className="propostas">
                hi
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