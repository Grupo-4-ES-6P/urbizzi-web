import { ChevronLeft, ChevronRight, Download, Plus, Search } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { Badge } from '../../components/ui'
import { useDb } from '../../data/db'
import { baixarCsv } from '../../lib/csv'
import { formatarMoedaAbreviada, formatarMoedaInteira, normalizar } from '../../lib/format'
import { formatarData } from '../../lib/reservas'
import { useAgora } from '../../lib/useAgora'
import { compararPorData, FILTROS_VENDA, resumoVendas, STATUS_VENDA, type FiltroVendas } from '../../lib/vendas'
import { gerarCsvVendas, montarLinhas, nomeArquivoVendas, type LinhaVenda } from './venda'

const POR_PAGINA = 8

const ehFiltro = (v: string | null): v is FiltroVendas => FILTROS_VENDA.some((f) => f.valor === v)
const corresponde = (l: LinhaVenda, f: FiltroVendas) => f === 'todas' || l.venda.status === f
const plural = (n: number, singular: string, plural: string) => `${n} ${n === 1 ? singular : plural}`

export function VendasPage() {
  const db = useDb()
  const agora = useAgora()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const statusParam = params.get('status')
  const filtro: FiltroVendas = ehFiltro(statusParam) ? statusParam : 'todas'
  const pagina = Math.max(1, Number(params.get('pagina')) || 1)

  const alterar = (chave: string, valor: string) => {
    const novo = new URLSearchParams(params)
    if (valor) novo.set(chave, valor)
    else novo.delete(chave)
    if (chave !== 'pagina') novo.delete('pagina')
    setParams(novo, { replace: true })
  }

  const linhas = useMemo(() => montarLinhas(db, [...db.vendas].sort(compararPorData)), [db])
  // O resumo considera todas as vendas, independente da busca e do filtro.
  const resumo = resumoVendas(db.vendas, agora)
  const termo = normalizar(q.trim())
  const buscadas = termo
    ? linhas.filter((l) => normalizar(`${l.imovelRotulo} ${l.clienteNome} ${l.corretorNome}`).includes(termo))
    : linhas
  const filtradas = buscadas.filter((l) => corresponde(l, filtro))
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA))
  const paginaAtual = Math.min(pagina, totalPaginas)
  const visiveis = filtradas.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA)

  // Exporta tudo o que passou pela busca e pelo filtro, não só a página atual.
  const exportar = () => baixarCsv(nomeArquivoVendas(new Date()), gerarCsvVendas(filtradas))

  return (
    <>
      <header className="cabecalho">
        <div>
          <h1 className="cabecalho__titulo">Vendas</h1>
          <p className="cabecalho__subtitulo">
            {plural(resumo.registradas, 'venda registrada', 'vendas registradas')} ·{' '}
            {formatarMoedaAbreviada(resumo.valorNoAno)} no ano · {plural(resumo.canceladas, 'cancelada', 'canceladas')}
          </p>
        </div>
        <div className="cabecalho__acoes">
          <button type="button" className="btn btn--secundario" onClick={exportar} disabled={filtradas.length === 0}>
            <Download size={15} aria-hidden /> Exportar CSV
          </button>
          <Link to="/vendas/nova" className="btn btn--primario">
            <Plus size={16} aria-hidden /> Registrar venda
          </Link>
        </div>
      </header>

      <main className="conteudo pilha">
        <section className="card">
          <div className="card__cabecalho">
            <div>
              <h2 className="card__titulo">Vendas registradas</h2>
              <p className="card__subtitulo">Cancelamentos exigem justificativa e ficam registrados na auditoria</p>
            </div>
          </div>
          <div className="filtros">
            <div className="busca busca--larga">
              <Search size={15} className="busca__icone" aria-hidden />
              <input
                type="search"
                className="busca__input"
                placeholder="Imóvel, comprador ou corretor"
                aria-label="Buscar vendas"
                value={q}
                onChange={(e) => alterar('q', e.target.value)}
              />
            </div>
            <div className="segmentos" role="group" aria-label="Filtrar vendas por status">
              {FILTROS_VENDA.map((f) => (
                <button
                  key={f.valor}
                  type="button"
                  className="segmentos__item"
                  aria-pressed={f.valor === filtro}
                  onClick={() => alterar('status', f.valor === 'todas' ? '' : f.valor)}
                >
                  {f.rotulo}
                  <span className="segmentos__contagem">{buscadas.filter((l) => corresponde(l, f.valor)).length}</span>
                </button>
              ))}
            </div>
          </div>

          {filtradas.length === 0 ? (
            <p className="card__vazio">
              {linhas.length === 0
                ? 'Nenhuma venda registrada ainda.'
                : termo
                  ? `Nenhuma venda encontrada para "${q.trim()}".`
                  : 'Nenhuma venda neste status.'}
            </p>
          ) : (
            <div className="tabela-wrap">
              <table className="tabela tabela--clicavel">
                <thead>
                  <tr>
                    <th scope="col">Imóvel</th>
                    <th scope="col">Comprador</th>
                    <th scope="col">Corretor</th>
                    <th scope="col">Valor da venda</th>
                    <th scope="col">Data</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((l) => {
                    const s = STATUS_VENDA[l.venda.status]
                    return (
                      <tr key={l.venda.id} onClick={() => navigate(`/vendas/${l.venda.id}`)}>
                        <td>
                          <Link
                            to={`/vendas/${l.venda.id}`}
                            className="tabela__destaque"
                            aria-label={`${l.imovelRotulo} — detalhes da venda ${l.venda.codigo}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {l.imovelRotulo}
                          </Link>
                        </td>
                        <td>{l.clienteNome}</td>
                        <td>{l.corretorNome}</td>
                        <td>{formatarMoedaInteira(l.venda.valor)}</td>
                        <td>
                          <time dateTime={l.venda.data}>{formatarData(l.venda.data)}</time>
                        </td>
                        <td>
                          <Badge variante={s.variante}>{s.rotulo}</Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {filtradas.length > POR_PAGINA && (
            <div className="paginacao">
              <span>
                {`${(paginaAtual - 1) * POR_PAGINA + 1}–${Math.min(paginaAtual * POR_PAGINA, filtradas.length)} de ${filtradas.length}`}
              </span>
              <div>
                <button
                  type="button"
                  className="btn btn--secundario btn--icone"
                  disabled={paginaAtual <= 1}
                  onClick={() => alterar('pagina', String(paginaAtual - 1))}
                  aria-label="Página anterior"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  className="btn btn--secundario btn--icone"
                  disabled={paginaAtual >= totalPaginas}
                  onClick={() => alterar('pagina', String(paginaAtual + 1))}
                  aria-label="Próxima página"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </>
  )
}
