import { ImageDown, List } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { Badge } from '../../components/ui'
import { useToast } from '../../contexts/ToastContext'
import { useDb } from '../../data/db'
import { indexar, nomeLote, reservaAtiva, SITUACAO_EXIBICAO } from '../../data/selectors'
import type { Imovel, Situacao } from '../../data/types'
import { formatarMoedaInteira } from '../../lib/format'

const CORES: Record<Situacao, string> = {
  disponivel: '#2f8a55',
  reservado: '#e0922a',
  vendido: '#f0641e',
  bloqueado: '#8e8e93',
}

/** Gera um PNG da planta a partir dos dados (não depende de print da tela). */
async function exportarPng(nome: string, linhas: { quadra: string; lotes: Imovel[] }[]) {
  const T = 34
  const G = 6
  const margemEsq = 70
  const topo = 60
  const colunas = Math.max(...linhas.map((l) => l.lotes.length), 1)
  const largura = margemEsq + colunas * (T + G) + 20
  const altura = topo + linhas.length * (T + G) + 50
  const blocos = linhas
    .map((linha, y) => {
      const nomeQuadra = linha.quadra ? `Qd. ${linha.quadra}` : 'Lotes'
      const rotulo = `<text x="10" y="${topo + y * (T + G) + T / 2 + 4}" font-size="12" fill="#62626a">${nomeQuadra}</text>`
      const lotes = linha.lotes
        .map(
          (l, x) =>
            `<rect x="${margemEsq + x * (T + G)}" y="${topo + y * (T + G)}" width="${T}" height="${T}" rx="4" fill="${CORES[l.situacao]}"/>` +
            `<text x="${margemEsq + x * (T + G) + T / 2}" y="${topo + y * (T + G) + T / 2 + 4}" font-size="11" fill="#fff" text-anchor="middle">${l.endereco.lote}</text>`,
        )
        .join('')
      return rotulo + lotes
    })
    .join('')
  const legenda = (Object.keys(CORES) as Situacao[])
    .map((s, i) => `<rect x="${10 + i * 110}" y="${altura - 28}" width="12" height="12" rx="2" fill="${CORES[s]}"/><text x="${28 + i * 110}" y="${altura - 18}" font-size="12" fill="#16161a">${SITUACAO_EXIBICAO[s].rotulo}</text>`)
    .join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${largura}" height="${altura}" font-family="sans-serif"><rect width="100%" height="100%" fill="#fff"/><text x="10" y="30" font-size="18" font-weight="700" fill="#16161a">Mapa do loteamento — ${nome}</text>${blocos}${legenda}</svg>`

  const img = new Image()
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Falha ao gerar a imagem.'))
    img.src = url
  })
  const canvas = document.createElement('canvas')
  canvas.width = largura * 2
  canvas.height = altura * 2
  const ctx = canvas.getContext('2d')!
  ctx.scale(2, 2)
  ctx.drawImage(img, 0, 0)
  URL.revokeObjectURL(url)
  const a = document.createElement('a')
  a.href = canvas.toDataURL('image/png')
  a.download = `mapa-${nome.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}.png`
  a.click()
}

export function MapaLoteamentoPage() {
  const { id } = useParams()
  const db = useDb()
  const navigate = useNavigate()
  const notificar = useToast()
  const loteamento = db.loteamentos.find((l) => l.id === id)
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null)

  const linhas = useMemo(() => {
    if (!loteamento) return []
    const lotes = db.imoveis.filter((i) => i.loteamento === loteamento.nome && i.status === 'publicado')
    const quadras = [...new Set(lotes.map((i) => i.endereco.quadra))].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }))
    return quadras.map((quadra) => ({
      quadra,
      lotes: lotes.filter((i) => i.endereco.quadra === quadra).sort((a, b) => a.endereco.lote.localeCompare(b.endereco.lote, 'pt-BR', { numeric: true })),
    }))
  }, [db.imoveis, loteamento])

  if (!loteamento) {
    return (
      <main className="conteudo">
        <section className="card vazio">
          <h2>Loteamento não encontrado</h2>
          <Link to="/imoveis/loteamentos" className="btn btn--secundario">Voltar</Link>
        </section>
      </main>
    )
  }

  const todos = linhas.flatMap((l) => l.lotes)
  const selecionado = todos.find((i) => i.id === selecionadoId)
  const pessoas = indexar([...db.clientes, ...db.corretores])
  const agora = Date.now()
  const reserva = selecionado && db.reservas.find((r) => r.imovelId === selecionado.id && reservaAtiva(r, agora))
  const proposta = selecionado && db.propostas.filter((p) => p.imovelId === selecionado.id).sort((a, b) => b.criadaEm.localeCompare(a.criadaEm))[0]
  const venda = selecionado && db.vendas.find((v) => v.imovelId === selecionado.id && v.status === 'ativa')
  const clienteId = reserva?.clienteId ?? venda?.clienteId ?? (proposta?.status === 'pendente' ? proposta.clienteId : undefined)
  const responsavelId = reserva?.corretorId ?? proposta?.corretorId
  const statusProposta = { pendente: 'em análise', aprovada: 'aprovada', recusada: 'recusada' }

  return (
    <>
      <header className="cabecalho">
        <div>
          <nav className="migalhas" aria-label="Você está em">
            <Link to="/imoveis">Imóveis</Link>
            <span aria-hidden>›</span>
            <Link to={`/imoveis/loteamentos/${loteamento.id}`}>{loteamento.nome}</Link>
            <span aria-hidden>›</span>
            <span>Mapa</span>
          </nav>
          <h1 className="cabecalho__titulo">Mapa do loteamento — {loteamento.nome}</h1>
          <p className="cabecalho__subtitulo">Clique em um lote para ver os dados e a situação · RF09</p>
        </div>
        <div className="cabecalho__acoes">
          <button
            type="button"
            className="btn btn--secundario"
            onClick={() => exportarPng(loteamento.nome, linhas).catch((e: Error) => notificar(e.message, 'erro'))}
          >
            <ImageDown size={15} /> Exportar imagem
          </button>
          <button type="button" className="btn btn--primario" onClick={() => navigate(`/imoveis?loteamento=${encodeURIComponent(loteamento.nome)}`)}>
            <List size={15} /> Ver como lista
          </button>
        </div>
      </header>

      <main className="conteudo pilha">
        <section className="card secao">
          <div className="secao__cabecalho">
            <h2 className="card__titulo">Planta do loteamento</h2>
            <p className="card__subtitulo">Cada retângulo é um lote; a cor mostra a situação atual.</p>
          </div>
          <ul className="legenda">
            {(Object.keys(CORES) as Situacao[]).map((s) => (
              <li key={s}>
                <span style={{ background: CORES[s] }} aria-hidden />
                {SITUACAO_EXIBICAO[s].rotulo} ({todos.filter((i) => i.situacao === s).length})
              </li>
            ))}
          </ul>
          {linhas.length === 0 ? (
            <p className="card__vazio">Nenhum lote cadastrado. Gere uma quadra para começar.</p>
          ) : (
            <div className="planta">
              {linhas.map((linha) => (
                <div key={linha.quadra} className="planta__linha">
                  <span className="planta__quadra">{linha.quadra ? `Qd. ${linha.quadra}` : 'Lotes'}</span>
                  <div className="planta__lotes">
                    {linha.lotes.map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        className={`planta__lote ${l.id === selecionadoId ? 'planta__lote--ativo' : ''}`}
                        style={{ background: CORES[l.situacao] }}
                        aria-pressed={l.id === selecionadoId}
                        aria-label={`${nomeLote(l.endereco.lote, linha.quadra, ', ')} — ${SITUACAO_EXIBICAO[l.situacao].rotulo}`}
                        title={`Lote ${l.endereco.lote} · ${SITUACAO_EXIBICAO[l.situacao].rotulo}`}
                        onClick={() => setSelecionadoId(l.id)}
                      >
                        {l.endereco.lote}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card secao" aria-live="polite">
          <div className="secao__cabecalho secao__cabecalho--linha">
            <div>
              <h2 className="card__titulo">
                {selecionado
                  ? `Lote selecionado — ${nomeLote(selecionado.endereco.lote, selecionado.endereco.quadra, ', ')}`
                  : 'Nenhum lote selecionado'}
              </h2>
              <p className="card__subtitulo">{selecionado ? 'Dados do lote destacado na planta.' : 'Clique em um lote da planta.'}</p>
            </div>
            {selecionado && (
              <Link to={`/imoveis/${selecionado.id}`} className="link">
                Abrir imóvel
              </Link>
            )}
          </div>
          {selecionado && (
            <dl className="ficha ficha--6">
              <div><dt>Lote</dt><dd>Lote {selecionado.endereco.lote}{selecionado.endereco.quadra && ` — Qd. ${selecionado.endereco.quadra}`}</dd></div>
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
          <p className="nota-regra">RF09 — o mapa reflete a situação em tempo real. Lotes vendidos e bloqueados não aparecem no catálogo público (RF31).</p>
        </section>
      </main>
    </>
  )
}
