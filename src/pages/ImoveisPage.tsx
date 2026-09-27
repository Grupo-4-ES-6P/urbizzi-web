import { ChevronLeft, ChevronRight, Map as MapIcon, Plus, Search, Upload } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { ImportarPlanilha } from '../components/ImportarPlanilha'
import { Badge } from '../components/ui'
import { SITUACOES } from '../data/catalogos'
import { useDb } from '../data/db'
import { contarPor, imoveisComPropostaPendente, rotuloImovel, situacaoExibida } from '../data/selectors'
import { formatarDecimal, formatarMoedaInteira, normalizar } from '../lib/format'

const POR_PAGINA = 20

const FAIXAS_AREA = [
  { valor: '0-400', rotulo: 'Até 400 m²' },
  { valor: '400-600', rotulo: '400 a 600 m²' },
  { valor: '600-1000', rotulo: '600 a 1.000 m²' },
  { valor: '1000-', rotulo: 'Acima de 1.000 m²' },
]
const FAIXAS_VALOR = [
  { valor: '0-150000', rotulo: 'Até R$ 150 mil' },
  { valor: '150000-300000', rotulo: 'R$ 150 a 300 mil' },
  { valor: '300000-500000', rotulo: 'R$ 300 a 500 mil' },
  { valor: '500000-', rotulo: 'Acima de R$ 500 mil' },
]

function dentroDaFaixa(valor: number | null, faixa: string) {
  if (!faixa) return true
  if (valor === null) return false
  const [min, max] = faixa.split('-').map((x) => (x ? Number(x) : null))
  return (min === null || valor >= min) && (max === null || valor < max)
}

export function ImoveisPage() {
  const db = useDb()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [importando, setImportando] = useState(false)
  const q = params.get('q') ?? ''
  const loteamento = params.get('loteamento') ?? ''
  const quadra = params.get('quadra') ?? ''
  const situacao = params.get('situacao') ?? ''
  const area = params.get('area') ?? ''
  const valor = params.get('valor') ?? ''
  const pagina = Math.max(1, Number(params.get('pagina')) || 1)

  const alterar = (chave: string, novoValor: string) => {
    const novo = new URLSearchParams(params)
    if (novoValor) novo.set(chave, novoValor)
    else novo.delete(chave)
    if (chave !== 'pagina') novo.delete('pagina')
    if (chave === 'loteamento') novo.delete('quadra')
    setParams(novo, { replace: true })
  }

  const pendentes = useMemo(() => imoveisComPropostaPendente(db), [db])
  const interesses = useMemo(() => contarPor(db.interesses, (i) => i.imovelId), [db.interesses])
  const quadrasDoLoteamento = useMemo(
    () =>
      db.quadras
        .filter((qd) => qd.loteamento === loteamento && qd.identificacao)
        .map((qd) => qd.identificacao)
        .sort(),
    [db.quadras, loteamento],
  )

  const filtrados = useMemo(() => {
    const termo = normalizar(q.trim())
    return db.imoveis
      .filter((i) => !loteamento || i.loteamento === loteamento)
      .filter((i) => !quadra || i.endereco.quadra === quadra)
      .filter((i) => {
        if (!situacao) return true
        if (situacao === 'rascunho') return i.status === 'rascunho'
        if (situacao === 'em_aprovacao') return pendentes.has(i.id)
        return i.situacao === situacao && i.status === 'publicado'
      })
      .filter((i) => dentroDaFaixa(i.dimensoes.areaTotal, area))
      .filter((i) => dentroDaFaixa(i.valores.tabela, valor))
      .filter(
        (i) =>
          !termo ||
          normalizar(`${rotuloImovel(i)} ${i.titulo} ${i.codigo} ${i.matricula}`).includes(termo),
      )
      .sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm))
  }, [db.imoveis, q, loteamento, quadra, situacao, area, valor, pendentes])

  const publicados = db.imoveis.filter((i) => i.status === 'publicado')
  const contar = (s: string) => publicados.filter((i) => i.situacao === s).length
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA))
  const paginaAtual = Math.min(pagina, totalPaginas)
  const visiveis = filtrados.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA)
  const temFiltro = q || loteamento || quadra || situacao || area || valor

  return (
    <>
      <header className="cabecalho">
        <div>
          <h1 className="cabecalho__titulo">Imóveis</h1>
          <p className="cabecalho__subtitulo">
            {db.imoveis.length} cadastrados · {contar('disponivel')} disponíveis · {contar('reservado')} reservados ·{' '}
            {contar('vendido')} vendidos
          </p>
        </div>
        <div className="cabecalho__acoes">
          <Link to="/imoveis/loteamentos" className="btn btn--secundario">
            <MapIcon size={15} /> Loteamentos
          </Link>
          <button type="button" className="btn btn--secundario" onClick={() => setImportando(true)}>
            <Upload size={15} /> Importar planilha
          </button>
          <Link to="/imoveis/novo" className="btn btn--primario">
            <Plus size={16} /> Novo imóvel
          </Link>
        </div>
      </header>

      <main className="conteudo">
        <section className="card">
          <div className="card__cabecalho">
            <div>
              <h2 className="card__titulo">Todos os imóveis</h2>
              <p className="card__subtitulo">Filtre por loteamento, quadra, matrícula, situação, área ou faixa de valor</p>
            </div>
            {temFiltro && (
              <button type="button" className="link" onClick={() => setParams({}, { replace: true })}>
                Limpar filtros
              </button>
            )}
          </div>
          <div className="filtros">
            <div className="busca busca--larga">
              <Search size={15} className="busca__icone" aria-hidden />
              <input
                type="search"
                className="busca__input"
                placeholder="Lote, matrícula ou código"
                aria-label="Buscar imóveis"
                value={q}
                onChange={(e) => alterar('q', e.target.value)}
              />
            </div>
            <select className="input select" aria-label="Loteamento" value={loteamento} onChange={(e) => alterar('loteamento', e.target.value)}>
              <option value="">Todos os loteamentos</option>
              {db.loteamentos.map((l) => (
                <option key={l.id}>{l.nome}</option>
              ))}
            </select>
            <select
              className="input select"
              aria-label="Quadra"
              value={quadra}
              disabled={!loteamento || quadrasDoLoteamento.length === 0}
              onChange={(e) => alterar('quadra', e.target.value)}
            >
              <option value="">Todas as quadras</option>
              {quadrasDoLoteamento.map((qd) => (
                <option key={qd} value={qd}>
                  Qd. {qd}
                </option>
              ))}
            </select>
            <select className="input select" aria-label="Situação" value={situacao} onChange={(e) => alterar('situacao', e.target.value)}>
              <option value="">Todas as situações</option>
              {SITUACOES.map((s) => (
                <option key={s.valor} value={s.valor}>
                  {s.rotulo}
                </option>
              ))}
              <option value="em_aprovacao">Em aprovação</option>
              <option value="rascunho">Rascunho</option>
            </select>
            <select className="input select" aria-label="Área" value={area} onChange={(e) => alterar('area', e.target.value)}>
              <option value="">Qualquer área</option>
              {FAIXAS_AREA.map((f) => (
                <option key={f.valor} value={f.valor}>
                  {f.rotulo}
                </option>
              ))}
            </select>
            <select className="input select" aria-label="Faixa de valor" value={valor} onChange={(e) => alterar('valor', e.target.value)}>
              <option value="">Qualquer valor</option>
              {FAIXAS_VALOR.map((f) => (
                <option key={f.valor} value={f.valor}>
                  {f.rotulo}
                </option>
              ))}
            </select>
          </div>

          {visiveis.length === 0 ? (
            <p className="card__vazio">Nenhum imóvel encontrado com esses filtros.</p>
          ) : (
            <div className="tabela-wrap">
              <table className="tabela tabela--clicavel">
                <thead>
                  <tr>
                    <th>Imóvel</th>
                    <th>Matrícula</th>
                    <th>Loteamento</th>
                    <th>Área</th>
                    <th>Valor de tabela</th>
                    <th>Situação</th>
                    <th>Interesse</th>
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((i) => {
                    const s = situacaoExibida(i, pendentes)
                    const contatos = interesses.get(i.id) ?? 0
                    return (
                      <tr key={i.id} onClick={() => navigate(`/imoveis/${i.id}`)}>
                        <td>
                          <Link to={`/imoveis/${i.id}`} className="tabela__destaque" onClick={(e) => e.stopPropagation()}>
                            {rotuloImovel(i, false)}
                          </Link>
                        </td>
                        <td>{i.matricula ? Number(i.matricula).toLocaleString('pt-BR') : <em className="texto-fraco">Pendente</em>}</td>
                        <td>{i.loteamento || '—'}</td>
                        <td>{i.dimensoes.areaTotal ? `${formatarDecimal(i.dimensoes.areaTotal).replace(/,00$/, '')} m²` : '—'}</td>
                        <td>{i.valores.tabela ? formatarMoedaInteira(i.valores.tabela) : '—'}</td>
                        <td>
                          <Badge variante={s.variante}>{s.rotulo}</Badge>
                        </td>
                        <td>{contatos ? `${contatos} ${contatos === 1 ? 'contato' : 'contatos'}` : '—'}</td>
                      </tr>
                    )
                  })}
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
      <ImportarPlanilha aberto={importando} onFechar={() => setImportando(false)} />
    </>
  )
}
