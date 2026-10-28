import { ChevronLeft, ChevronRight, Download, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { Dialogo } from '../../components/Dialogo'
import { Badge } from '../../components/ui'
import { useToast } from '../../contexts/ToastContext'
import { useDb } from '../../data/db'
import type { Cliente } from '../../data/types'
import { SITUACAO_CLIENTE, situacaoCliente, ultimoContato, vinculosClientes } from '../../lib/clientes'
import { baixarCsv, gerarCsv } from '../../lib/csv'
import { formatarData, normalizar } from '../../lib/format'
import { useAgora } from '../../lib/useAgora'
import { alterarStatusClientes, excluirClientes } from '../../services/api'

const POR_PAGINA = 20

const FILTROS_STATUS = [
  { valor: '', rotulo: 'Todos os status' },
  { valor: 'ativo', rotulo: 'Ativos' },
  { valor: 'inativo', rotulo: 'Inativos' },
]

export function ClientesPage() {
  const db = useDb()
  const agora = useAgora()
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

  const vinculos = useMemo(() => vinculosClientes(db, agora), [db, agora])

  const filtrados = useMemo(() => {
    const termo = normalizar(q.trim())
    const digitos = q.replace(/\D/g, '')
    return db.clientes
      .filter((c) => !status || (status === 'ativo') === c.ativo)
      .filter(
        (c) =>
          !termo ||
          normalizar(`${c.nome} ${c.email} ${c.responsavel}`).includes(termo) ||
          (digitos.length >= 3 && `${c.telefone} ${c.celular} ${c.cpfCnpj}`.replace(/\D/g, '').includes(digitos)),
      )
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [db.clientes, q, status])

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA))
  const paginaAtual = Math.min(pagina, totalPaginas)
  const visiveis = filtrados.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA)
  const todosVisiveisMarcados = visiveis.length > 0 && visiveis.every((c) => selecionados.has(c.id))
  const comReservaAtiva = db.clientes.filter((c) => vinculos.comReservaAtiva.has(c.id)).length
  const comPropostaEmAnalise = db.clientes.filter((c) => vinculos.comPropostaEmAndamento.has(c.id)).length
  // Sem nenhum cadastro, a lista filtrada também fica vazia.
  const mensagemVazia = db.clientes.length === 0 ? 'Nenhum cliente cadastrado ainda.' : 'Nenhum cliente encontrado com esses filtros.'
  const contatoPrincipal = (c: Cliente) => c.celular || c.telefone || c.email

  const exportar = () => {
    const csv = gerarCsv(
      ['Cliente', 'CPF / CNPJ', 'Celular', 'Telefone', 'E-mail', 'Responsável', 'Último contato', 'Situação'],
      filtrados.map((c) => {
        const ultimo = ultimoContato(c)
        return [
          c.nome,
          c.cpfCnpj,
          c.celular,
          c.telefone,
          c.email,
          c.responsavel,
          ultimo ? formatarData(ultimo.data) : '',
          SITUACAO_CLIENTE[situacaoCliente(c, vinculos)].rotulo,
        ]
      }),
    )
    baixarCsv('clientes.csv', csv)
  }

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
            {db.clientes.length} cadastrados · {comReservaAtiva} com reserva ativa · {comPropostaEmAnalise} com proposta em análise
          </p>
        </div>
        <div className="cabecalho__acoes">
          <button type="button" className="btn btn--secundario" onClick={exportar} disabled={filtrados.length === 0}>
            <Download size={15} /> Exportar
          </button>
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
              <p className="card__subtitulo">Busca por nome, CPF/CNPJ, e-mail ou responsável comercial</p>
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
                placeholder="Nome, CPF/CNPJ, e-mail ou responsável"
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
              <fieldset className="acoes-lote" aria-label="Ações para os selecionados">
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
              </fieldset>
            )}
          </div>

          {visiveis.length === 0 ? (
            <p className="card__vazio">{mensagemVazia}</p>
          ) : (
            <div className="tabela-wrap">
              <table className="tabela tabela--clicavel">
                <thead>
                  <tr>
                    <th className="tabela__selecao">
                      <input type="checkbox" aria-label="Selecionar todos os clientes da página" checked={todosVisiveisMarcados} onChange={alternarTodos} />
                    </th>
                    <th>Cliente</th>
                    <th>CPF / CNPJ</th>
                    <th>Contato</th>
                    <th>Responsável</th>
                    <th>Último contato</th>
                    <th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((c) => {
                    const ultimo = ultimoContato(c)
                    const situacao = SITUACAO_CLIENTE[situacaoCliente(c, vinculos)]
                    return (
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
                        <td>{contatoPrincipal(c) || '—'}</td>
                        <td>{c.responsavel || '—'}</td>
                        <td>{ultimo ? formatarData(ultimo.data) : '—'}</td>
                        <td>
                          <Badge variante={situacao.variante}>{situacao.rotulo}</Badge>
                        </td>
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
