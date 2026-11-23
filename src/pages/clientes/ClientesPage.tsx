import { ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { Dialogo } from '../../components/Dialogo'
import { Badge } from '../../components/ui'
import { useToast } from '../../contexts/ToastContext'
import { useDb } from '../../data/db'
import { contarPor } from '../../data/selectors'
import { normalizar } from '../../lib/format'
import { alterarStatusClientes, excluirClientes } from '../../services/api'

const POR_PAGINA = 20

const FILTROS_STATUS = [
  { valor: '', rotulo: 'Todos os status' },
  { valor: 'ativo', rotulo: 'Ativos' },
  { valor: 'inativo', rotulo: 'Inativos' },
]

export function ClientesPage() {
  const db = useDb()
  const navigate = useNavigate()
  const notificar = useToast()
  const [params, setParams] = useSearchParams()
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [confirmarExclusao, setConfirmarExclusao] = useState(false)
  const [processando, setProcessando] = useState(false)
  const q = params.get('q') ?? ''
  const status = params.get('status') ?? ''
  const pagina = Math.max(1, Number(params.get('pagina')) || 1)

  const alterar = (chave: string, valor: string) => {
    const novo = new URLSearchParams(params)
    if (valor) novo.set(chave, valor)
    else novo.delete(chave)
    if (chave !== 'pagina') novo.delete('pagina')
    setParams(novo, { replace: true })
  }

  const reservasAtivas = useMemo(
    () => contarPor(db.reservas.filter((r) => r.status === 'ativa'), (r) => r.clienteId),
    [db.reservas],
  )

  const filtrados = useMemo(() => {
    const termo = normalizar(q.trim())
    const digitos = q.replace(/\D/g, '')
    return db.clientes
      .filter((c) => !status || (status === 'ativo') === c.ativo)
      .filter(
        (c) =>
          !termo ||
          normalizar(`${c.nome} ${c.email}`).includes(termo) ||
          (digitos.length >= 3 && `${c.telefone} ${c.cpfCnpj}`.replace(/\D/g, '').includes(digitos)),
      )
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [db.clientes, q, status])

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA))
  const paginaAtual = Math.min(pagina, totalPaginas)
  const visiveis = filtrados.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA)
  const todosVisiveisMarcados = visiveis.length > 0 && visiveis.every((c) => selecionados.has(c.id))
  const ativos = db.clientes.filter((c) => c.ativo).length

  const alternar = (id: string) =>
    setSelecionados((atual) => {
      const novo = new Set(atual)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })

  const alternarTodos = () =>
    setSelecionados((atual) => {
      const novo = new Set(atual)
      for (const c of visiveis) {
        if (todosVisiveisMarcados) novo.delete(c.id)
        else novo.add(c.id)
      }
      return novo
    })

  const executar = async (acao: () => Promise<void>, sucesso: string) => {
    setProcessando(true)
    try {
      await acao()
      setSelecionados(new Set())
      notificar(sucesso)
    } catch (e) {
      notificar(e instanceof Error ? e.message : 'Não foi possível concluir a ação.', 'erro')
    } finally {
      setProcessando(false)
      setConfirmarExclusao(false)
    }
  }

  const quantidade = selecionados.size
  const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

  return (
    <>
      <header className="cabecalho">
        <div>
          <h1 className="cabecalho__titulo">Clientes</h1>
          <p className="cabecalho__subtitulo">
            {db.clientes.length} cadastrados · {ativos} ativos · {db.clientes.length - ativos} inativos
          </p>
        </div>
        <div className="cabecalho__acoes">
          <Link to="/clientes/novo" className="btn btn--primario">
            <Plus size={16} /> Novo cliente
          </Link>
        </div>
      </header>

      <main className="conteudo">
        <section className="card">
          <div className="card__cabecalho">
            <div>
              <h2 className="card__titulo">Todos os clientes</h2>
              <p className="card__subtitulo">Clique em um cliente para ver e editar o cadastro</p>
            </div>
            {(q || status) && (
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
                placeholder="Nome, CPF/CNPJ, telefone ou e-mail"
                aria-label="Buscar clientes"
                value={q}
                onChange={(e) => alterar('q', e.target.value)}
              />
            </div>
            <select className="input select" aria-label="Status" value={status} onChange={(e) => alterar('status', e.target.value)}>
              {FILTROS_STATUS.map((f) => (
                <option key={f.valor} value={f.valor}>
                  {f.rotulo}
                </option>
              ))}
            </select>
            {quantidade > 0 && (
              <div className="acoes-lote" role="group" aria-label="Ações para os selecionados">
                <span>{plural(quantidade, 'selecionado', 'selecionados')}</span>
                <button
                  type="button"
                  className="btn btn--secundario btn--pequeno"
                  disabled={processando}
                  onClick={() => executar(() => alterarStatusClientes([...selecionados], true), 'Clientes ativados.')}
                >
                  Ativar
                </button>
                <button
                  type="button"
                  className="btn btn--secundario btn--pequeno"
                  disabled={processando}
                  onClick={() => executar(() => alterarStatusClientes([...selecionados], false), 'Clientes desativados.')}
                >
                  Desativar
                </button>
                <button type="button" className="btn btn--fantasma-perigo btn--pequeno" disabled={processando} onClick={() => setConfirmarExclusao(true)}>
                  Excluir
                </button>
              </div>
            )}
          </div>

          {db.clientes.length === 0 ? (
            <p className="card__vazio">Nenhum cliente cadastrado ainda.</p>
          ) : visiveis.length === 0 ? (
            <p className="card__vazio">Nenhum cliente encontrado com esses filtros.</p>
          ) : (
            <div className="tabela-wrap">
              <table className="tabela tabela--clicavel">
                <thead>
                  <tr>
                    <th className="tabela__selecao">
                      <input type="checkbox" aria-label="Selecionar todos os clientes da página" checked={todosVisiveisMarcados} onChange={alternarTodos} />
                    </th>
                    <th>Nome</th>
                    <th>CPF / CNPJ</th>
                    <th>Telefone</th>
                    <th>E-mail</th>
                    <th>Cidade</th>
                    <th>Reservas ativas</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((c) => (
                    <tr key={c.id} onClick={() => navigate(`/clientes/${c.id}`)}>
                      <td className="tabela__selecao" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" aria-label={`Selecionar ${c.nome}`} checked={selecionados.has(c.id)} onChange={() => alternar(c.id)} />
                      </td>
                      <td>
                        <Link to={`/clientes/${c.id}`} className="tabela__destaque" onClick={(e) => e.stopPropagation()}>
                          {c.nome}
                        </Link>
                      </td>
                      <td>{c.cpfCnpj || '—'}</td>
                      <td>{c.telefone || '—'}</td>
                      <td>{c.email || '—'}</td>
                      <td>{c.endereco.cidade ? `${c.endereco.cidade}/${c.endereco.uf}` : '—'}</td>
                      <td>{reservasAtivas.get(c.id) ?? '—'}</td>
                      <td>
                        <Badge variante={c.ativo ? 'normal' : 'neutro'}>{c.ativo ? 'Ativo' : 'Inativo'}</Badge>
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

      <Dialogo
        aberto={confirmarExclusao}
        titulo={`Excluir ${plural(quantidade, 'cliente', 'clientes')}?`}
        descricao="A exclusão é permanente. Clientes com reservas, propostas ou vendas não podem ser excluídos — desative-os."
        textoConfirmar={processando ? 'Excluindo…' : 'Excluir'}
        perigoso
        carregando={processando}
        onCancelar={() => setConfirmarExclusao(false)}
        onConfirmar={() => executar(() => excluirClientes([...selecionados]), `${plural(quantidade, 'cliente excluído', 'clientes excluídos')}.`)}
      />
    </>
  )
}
