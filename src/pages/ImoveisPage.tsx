import { ChevronLeft, ChevronRight, ImageOff, Plus, Search } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { Badge } from '../components/ui'
import { LOTEAMENTOS, rotuloSituacao, SITUACOES } from '../data/catalogos'
import { useDb } from '../data/db'
import { rotuloImovel } from '../data/selectors'
import type { Situacao } from '../data/types'
import { formatarDecimal, formatarMoedaInteira, normalizar } from '../lib/format'

const POR_PAGINA = 20

const VARIANTE_SITUACAO: Record<Situacao, string> = {
  disponivel: 'normal',
  reservado: 'atencao',
  vendido: 'neutro',
  indisponivel: 'critico',
}

export function ImoveisPage() {
  const db = useDb()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const situacao = params.get('situacao') ?? ''
  const loteamento = params.get('loteamento') ?? ''
  const status = params.get('status') ?? ''
  const pagina = Math.max(1, Number(params.get('pagina')) || 1)

  const alterar = (chave: string, valor: string) => {
    const novo = new URLSearchParams(params)
    if (valor) novo.set(chave, valor)
    else novo.delete(chave)
    if (chave !== 'pagina') novo.delete('pagina')
    setParams(novo, { replace: true })
  }

  const filtrados = useMemo(() => {
    const termo = normalizar(q.trim())
    return db.imoveis
      .filter((i) => !situacao || i.situacao === situacao)
      .filter((i) => !loteamento || i.loteamento === loteamento)
      .filter((i) => !status || i.status === status)
      .filter((i) => !termo || normalizar(`${rotuloImovel(i)} ${i.titulo} ${i.codigo} ${i.matricula}`).includes(termo))
      .sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm))
  }, [db.imoveis, q, situacao, loteamento, status])

  const rascunhos = db.imoveis.filter((i) => i.status === 'rascunho').length
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA))
  const paginaAtual = Math.min(pagina, totalPaginas)
  const visiveis = filtrados.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA)
  const temFiltro = q || situacao || loteamento || status

  return (
    <>
      <header className="cabecalho">
        <div>
          <h1 className="cabecalho__titulo">Imóveis</h1>
          <p className="cabecalho__subtitulo">
            {db.imoveis.length} cadastrados
            {rascunhos > 0 && (
              <>
                {' · '}
                <button type="button" className="link" onClick={() => alterar('status', 'rascunho')}>
                  {rascunhos} {rascunhos === 1 ? 'rascunho' : 'rascunhos'}
                </button>
              </>
            )}
          </p>
        </div>
        <div className="cabecalho__acoes">
          <Link to="/imoveis/novo" className="btn btn--primario">
            <Plus size={16} /> Novo imóvel
          </Link>
        </div>
      </header>

      <main className="conteudo">
        <section className="card">
          <div className="filtros">
            <div className="busca busca--larga">
              <Search size={15} className="busca__icone" aria-hidden />
              <input
                type="search"
                className="busca__input"
                placeholder="Buscar por lote, título, código ou matrícula"
                aria-label="Buscar imóveis"
                value={q}
                onChange={(e) => alterar('q', e.target.value)}
              />
            </div>
            <select className="input select" aria-label="Situação" value={situacao} onChange={(e) => alterar('situacao', e.target.value)}>
              <option value="">Todas as situações</option>
              {SITUACOES.map((s) => (
                <option key={s.valor} value={s.valor}>
                  {s.rotulo}
                </option>
              ))}
            </select>
            <select className="input select" aria-label="Loteamento" value={loteamento} onChange={(e) => alterar('loteamento', e.target.value)}>
              <option value="">Todos os loteamentos</option>
              {LOTEAMENTOS.map((l) => (
                <option key={l.nome}>{l.nome}</option>
              ))}
            </select>
            <select className="input select" aria-label="Publicação" value={status} onChange={(e) => alterar('status', e.target.value)}>
              <option value="">Publicados e rascunhos</option>
              <option value="publicado">Publicados</option>
              <option value="rascunho">Rascunhos</option>
            </select>
            {temFiltro && (
              <button type="button" className="link" onClick={() => setParams({}, { replace: true })}>
                Limpar filtros
              </button>
            )}
          </div>

          {visiveis.length === 0 ? (
            <p className="card__vazio">Nenhum imóvel encontrado com esses filtros.</p>
          ) : (
            <div className="tabela-wrap">
              <table className="tabela tabela--clicavel">
                <thead>
                  <tr>
                    <th>Imóvel</th>
                    <th>Código</th>
                    <th>Área</th>
                    <th>Valor de tabela</th>
                    <th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((i) => (
                    <tr key={i.id} onClick={() => navigate(`/imoveis/${i.id}`)}>
                      <td>
                        <div className="imovel-celula">
                          {i.fotos[0] ? (
                            <img src={i.fotos[0]} alt="" className="imovel-celula__foto" />
                          ) : (
                            <span className="imovel-celula__foto imovel-celula__foto--vazia">
                              <ImageOff size={14} aria-hidden />
                            </span>
                          )}
                          <span>
                            <Link to={`/imoveis/${i.id}`} className="tabela__destaque" onClick={(e) => e.stopPropagation()}>
                              {rotuloImovel(i)}
                            </Link>
                            <small>{i.titulo}</small>
                          </span>
                        </div>
                      </td>
                      <td>{i.codigo || '—'}</td>
                      <td>{i.dimensoes.areaTotal ? `${formatarDecimal(i.dimensoes.areaTotal)} m²` : '—'}</td>
                      <td>{i.valores.tabela ? formatarMoedaInteira(i.valores.tabela) : '—'}</td>
                      <td>
                        {i.status === 'rascunho' ? (
                          <Badge variante="rascunho">Rascunho</Badge>
                        ) : (
                          <Badge variante={VARIANTE_SITUACAO[i.situacao]}>{rotuloSituacao(i.situacao)}</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="paginacao">
            <span>
              {filtrados.length === 0
                ? '0 resultados'
                : `${(paginaAtual - 1) * POR_PAGINA + 1}–${Math.min(paginaAtual * POR_PAGINA, filtrados.length)} de ${filtrados.length}`}
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
        </section>
      </main>
    </>
  )
}
