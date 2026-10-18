import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { Badge } from '../../components/ui'
import { useDb } from '../../data/db'
import { indexar } from '../../data/selectors'
import type { ResultadoAcesso } from '../../data/types'
import { normalizar } from '../../lib/format'
import { RESULTADO_ACESSO } from '../../lib/usuarios'
import { dataHora } from '../propostas/proposta'

const POR_PAGINA = 20

const RESULTADOS = Object.keys(RESULTADO_ACESSO) as ResultadoAcesso[]
const ehResultado = (valor: string): valor is ResultadoAcesso => (RESULTADOS as string[]).includes(valor)

export function AcessosPage() {
  const db = useDb()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const resultadoParam = params.get('resultado') ?? ''
  const resultado = ehResultado(resultadoParam) ? resultadoParam : ''
  const pagina = Math.max(1, Number(params.get('pagina')) || 1)

  const alterar = (chave: string, valor: string) => {
    const novo = new URLSearchParams(params)
    if (valor) novo.set(chave, valor)
    else novo.delete(chave)
    if (chave !== 'pagina') novo.delete('pagina')
    setParams(novo, { replace: true })
  }

  const usuarios = useMemo(() => indexar(db.usuarios), [db.usuarios])
  const filtrados = useMemo(() => {
    const termo = normalizar(q.trim())
    return db.acessos
      .map((a) => ({ ...a, nome: a.usuarioId ? (usuarios.get(a.usuarioId)?.nome ?? 'Usuário removido') : 'E-mail não cadastrado' }))
      .filter((a) => (!resultado || a.resultado === resultado) && (!termo || normalizar(`${a.nome} ${a.email}`).includes(termo)))
      .sort((a, b) => b.data.localeCompare(a.data))
  }, [db.acessos, usuarios, q, resultado])

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA))
  const paginaAtual = Math.min(pagina, totalPaginas)
  const visiveis = filtrados.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA)
  const falhas = db.acessos.filter((a) => a.resultado !== 'sucesso').length

  return (
    <>
      <header className="cabecalho">
        <div>
          <nav className="migalhas" aria-label="Você está em">
            <Link to="/usuarios">Usuários</Link>
            <span aria-hidden>›</span>
            <span>Log de acessos</span>
          </nav>
          <h1 className="cabecalho__titulo">Log de acessos</h1>
          <p className="cabecalho__subtitulo">
            {db.acessos.length} {db.acessos.length === 1 ? 'tentativa de login registrada' : 'tentativas de login registradas'} · {falhas}{' '}
            {falhas === 1 ? 'recusada' : 'recusadas'}
          </p>
        </div>
        <div className="cabecalho__acoes">
          <Link to="/usuarios" className="btn btn--secundario">
            Voltar
          </Link>
        </div>
      </header>

      <main className="conteudo">
        <section className="card" aria-label="Tentativas de login">
          <div className="filtros">
            <div className="busca busca--larga">
              <Search size={15} className="busca__icone" aria-hidden />
              <input
                type="search"
                className="busca__input"
                placeholder="Nome ou e-mail"
                aria-label="Buscar acessos"
                value={q}
                onChange={(e) => alterar('q', e.target.value)}
              />
            </div>
            <select
              className="input select"
              aria-label="Resultado"
              value={resultado}
              onChange={(e) => alterar('resultado', e.target.value)}
            >
              <option value="">Todos os resultados</option>
              {RESULTADOS.map((r) => (
                <option key={r} value={r}>
                  {RESULTADO_ACESSO[r].rotulo}
                </option>
              ))}
            </select>
            {(q || resultado) && (
              <button type="button" className="link" onClick={() => setParams({}, { replace: true })}>
                Limpar filtros
              </button>
            )}
          </div>

          {visiveis.length === 0 ? (
            <p className="card__vazio">
              {db.acessos.length === 0 ? 'Nenhuma tentativa de login registrada ainda.' : 'Nenhum acesso encontrado com esses filtros.'}
            </p>
          ) : (
            <div className="tabela-wrap">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Data e hora</th>
                    <th>Usuário</th>
                    <th>E-mail informado</th>
                    <th>Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <time dateTime={a.data}>{dataHora(a.data)}</time>
                      </td>
                      <td className={a.usuarioId ? 'tabela__destaque' : undefined}>{a.nome}</td>
                      <td>{a.email}</td>
                      <td>
                        <Badge variante={RESULTADO_ACESSO[a.resultado].variante}>{RESULTADO_ACESSO[a.resultado].rotulo}</Badge>
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
