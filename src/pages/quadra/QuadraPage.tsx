import { Grid3x3, List } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { Badge } from '../../components/ui'
import { useDb } from '../../data/db'
import { CORES_SITUACAO, indexar, nomeLote, reservaAtiva, SITUACAO_EXIBICAO } from '../../data/selectors'
import type { Imovel, Situacao } from '../../data/types'
import { formatarDecimal, formatarMoedaInteira } from '../../lib/format'

/**
 * Divide os lotes em duas "fileiras" (frente e fundos da quadra) e distribui a
 * largura de cada lote proporcionalmente à sua testada (`frente`), para que o
 * quadrado grande fique subdividido em áreas de tamanhos variados — como no
 * loteamento real, onde os lotes não têm todos a mesma largura.
 */
function distribuirEmFileiras(lotes: Imovel[]) {
  const meio = Math.ceil(lotes.length / 2)
  const fileiras = [lotes.slice(0, meio), lotes.slice(meio)].filter((f) => f.length > 0)
  return fileiras
}

export function QuadraPage() {
  const { id, quadraId } = useParams()
  const db = useDb()
  const navigate = useNavigate()
  const loteamento = db.loteamentos.find((l) => l.id === id)
  const quadra = loteamento ? db.quadras.find((q) => q.id === quadraId && q.loteamento === loteamento.nome) : undefined
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null)

  const lotes = useMemo(() => {
    if (!loteamento || !quadra) return []
    return db.imoveis
      .filter((i) => i.loteamento === loteamento.nome && i.endereco.quadra === quadra.identificacao && i.status === 'publicado')
      .sort((a, b) => a.endereco.lote.localeCompare(b.endereco.lote, 'pt-BR', { numeric: true }))
  }, [db.imoveis, loteamento, quadra])

  const fileiras = useMemo(() => distribuirEmFileiras(lotes), [lotes])

  if (!loteamento) {
    return (
      <main className="conteudo">
        <section className="card vazio">
          <h2>Loteamento não encontrado</h2>
          <Link to="/loteamentos" className="btn btn--secundario">Voltar</Link>
        </section>
      </main>
    )
  }

  if (!quadra) {
    return (
      <main className="conteudo">
        <section className="card vazio">
          <h2>Quadra não encontrada</h2>
          <Link to={`/loteamentos/${loteamento.id}`} className="btn btn--secundario">Voltar ao loteamento</Link>
        </section>
      </main>
    )
  }

  const selecionado = lotes.find((i) => i.id === selecionadoId)
  const pessoas = indexar([...db.clientes, ...db.corretores])
  const agora = Date.now()
  const reserva = selecionado && db.reservas.find((r) => r.imovelId === selecionado.id && reservaAtiva(r, agora))
  const proposta = selecionado && db.propostas.filter((p) => p.imovelId === selecionado.id).sort((a, b) => b.criadaEm.localeCompare(a.criadaEm))[0]
  const venda = selecionado && db.vendas.find((v) => v.imovelId === selecionado.id && v.status === 'ativa')
  const clienteId = reserva?.clienteId ?? venda?.clienteId ?? (proposta?.status === 'pendente' ? proposta.clienteId : undefined)
  const responsavelId = reserva?.corretorId ?? proposta?.corretorId
  const statusProposta = { pendente: 'em análise', aprovada: 'aprovada', recusada: 'recusada' }
  const somaAreas = lotes.reduce((s, l) => s + (l.dimensoes.areaTotal ?? 0), 0)
  const titulo = quadra.identificacao ? `Qd. ${quadra.identificacao}` : 'Quadra'

  return (
    <>
      <header className="cabecalho">
        <div>
          <nav className="migalhas" aria-label="Você está em">
            <Link to="/imoveis">Imóveis</Link>
            <span aria-hidden>›</span>
            <Link to={`/loteamentos/${loteamento.id}`}>{loteamento.nome}</Link>
            <span aria-hidden>›</span>
            <span>{titulo}</span>
          </nav>
          <h1 className="cabecalho__titulo">{titulo} — {loteamento.nome}</h1>
          <p className="cabecalho__subtitulo">
            {lotes.length} {lotes.length === 1 ? 'lote' : 'lotes'}
            {quadra.area ? ` · ${formatarDecimal(quadra.area)} m² de área` : ''}
            {quadra.testadaPara ? ` · Testada para ${quadra.testadaPara}` : ''}
          </p>
        </div>
        <div className="cabecalho__acoes">
          <Link to={`/loteamentos/${loteamento.id}/mapa`} className="btn btn--secundario">
            <Grid3x3 size={15} /> Ver mapa do loteamento
          </Link>
          <button
            type="button"
            className="btn btn--primario"
            onClick={() => navigate(`/imoveis?loteamento=${encodeURIComponent(loteamento.nome)}&quadra=${quadra.identificacao}`)}
          >
            <List size={15} /> Ver como lista
          </button>
        </div>
      </header>

      <main className="conteudo pilha">
        <section className="card secao">
          <div className="secao__cabecalho">
            <h2 className="card__titulo">Planta da quadra</h2>
            <p className="card__subtitulo">O quadrado representa a quadra inteira; cada área é um lote, com a largura proporcional à testada.</p>
          </div>
          <ul className="legenda">
            {(Object.keys(CORES_SITUACAO) as Situacao[]).map((s) => (
              <li key={s}>
                <span style={{ background: CORES_SITUACAO[s] }} aria-hidden />
                {SITUACAO_EXIBICAO[s].rotulo} ({lotes.filter((i) => i.situacao === s).length})
              </li>
            ))}
          </ul>
          {lotes.length === 0 ? (
            <p className="card__vazio">Nenhum lote cadastrado nesta quadra.</p>
          ) : (
            <div className="quadra-planta">
              {fileiras.map((fileira, fi) => (
                <div key={fi} className="quadra-planta__fileira">
                  {fileira.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      className={`quadra-planta__lote ${l.id === selecionadoId ? 'quadra-planta__lote--ativo' : ''}`}
                      style={{ background: CORES_SITUACAO[l.situacao], flexGrow: l.dimensoes.frente ?? 1 }}
                      aria-pressed={l.id === selecionadoId}
                      aria-label={`${nomeLote(l.endereco.lote, quadra.identificacao, ', ')} — ${SITUACAO_EXIBICAO[l.situacao].rotulo}`}
                      title={`Lote ${l.endereco.lote} · ${SITUACAO_EXIBICAO[l.situacao].rotulo}`}
                      onClick={() => setSelecionadoId(l.id)}
                    >
                      {l.endereco.lote}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
          {lotes.length > 0 && (
            <p className="card__subtitulo" style={{ marginTop: 10 }}>
              Soma das áreas dos lotes: {formatarDecimal(somaAreas)} m²
              {quadra.area ? ` de ${formatarDecimal(quadra.area)} m² da quadra` : ''}
            </p>
          )}
        </section>

        <section className="card secao" aria-live="polite">
          <div className="secao__cabecalho secao__cabecalho--linha">
            <div>
              <h2 className="card__titulo">
                {selecionado
                  ? `Lote selecionado — ${nomeLote(selecionado.endereco.lote, quadra.identificacao, ', ')}`
                  : 'Nenhum lote selecionado'}
              </h2>
              <p className="card__subtitulo">{selecionado ? 'Dados do lote destacado na planta.' : 'Clique em uma área da planta.'}</p>
            </div>
            {selecionado && (
              <Link to={`/imoveis/${selecionado.id}`} className="link">
                Abrir imóvel
              </Link>
            )}
          </div>
          {selecionado && (
            <dl className="ficha ficha--6">
              <div><dt>Lote</dt><dd>Lote {selecionado.endereco.lote} — {titulo}</dd></div>
              <div><dt>Matrícula</dt><dd>{selecionado.matricula || 'Pendente'}</dd></div>
              <div><dt>Área</dt><dd>{selecionado.dimensoes.areaTotal?.toLocaleString('pt-BR') ?? '—'} m²</dd></div>
              <div><dt>Situação</dt><dd><Badge variante={SITUACAO_EXIBICAO[selecionado.situacao].variante}>{SITUACAO_EXIBICAO[selecionado.situacao].rotulo}</Badge></dd></div>
              <div><dt>Valor de tabela</dt><dd>{selecionado.valores.tabela ? formatarMoedaInteira(selecionado.valores.tabela) : '—'}</dd></div>
              <div><dt>Cliente</dt><dd>{clienteId ? pessoas.get(clienteId)?.nome : '—'}</dd></div>
              <div><dt>Reserva</dt><dd>{reserva ? `${reserva.codigo} · expira em ${new Date(reserva.expiraEm).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}` : '—'}</dd></div>
              <div><dt>Proposta</dt><dd>{proposta ? `${proposta.codigo} · ${statusProposta[proposta.status]}` : '—'}</dd></div>
              <div><dt>Responsável</dt><dd>{responsavelId ? pessoas.get(responsavelId)?.nome : '—'}</dd></div>
              {selecionado.bloqueio && <div><dt>Bloqueio</dt><dd>{selecionado.bloqueio.motivo}</dd></div>}
            </dl>
          )}
        </section>
      </main>
    </>
  )
}
