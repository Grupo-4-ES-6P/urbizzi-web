import { ChevronLeft, ChevronRight, KeyRound, Pencil, Plus, Search, UserCheck, UserCog, UserX } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { Dialogo } from '../../components/Dialogo'
import { MenuAcoes, type ItemMenu } from '../../components/MenuAcoes'
import { Badge } from '../../components/ui'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useDb } from '../../data/db'
import type { Usuario } from '../../data/types'
import { iniciais } from '../../lib/format'
import { PERFIS } from '../../lib/permissoes'
import { useAgora } from '../../lib/useAgora'
import {
  contarAtivosPorPerfil,
  ehPerfil,
  filtrarUsuarios,
  formatarUltimoAcesso,
  impedimentoAlterarPerfil,
  impedimentoInativar,
  ordenarUsuarios,
} from '../../lib/usuarios'
import { alterarStatusUsuario, redefinirSenha } from '../../services/usuarios'
import { ConviteDialogo } from './ConviteDialogo'
import { MatrizPermissoes } from './MatrizPermissoes'
import { PerfilDialogo } from './PerfilDialogo'

const POR_PAGINA = 20

const FILTROS_STATUS = [
  { valor: '', rotulo: 'Todos os status' },
  { valor: 'ativo', rotulo: 'Ativos' },
  { valor: 'inativo', rotulo: 'Inativos' },
] as const

type Confirmacao = { tipo: 'status' | 'senha'; usuario: Usuario }

export function UsuariosPage() {
  const db = useDb()
  const { usuario: logado } = useAuth()
  const notificar = useToast()
  const navigate = useNavigate()
  const agora = useAgora()
  const [params, setParams] = useSearchParams()
  const [convidando, setConvidando] = useState(false)
  const [editandoPerfil, setEditandoPerfil] = useState<Usuario | null>(null)
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null)
  const [processando, setProcessando] = useState(false)

  const executorId = logado?.id ?? ''
  const q = params.get('q') ?? ''
  const perfilParam = params.get('perfil') ?? ''
  const perfil = ehPerfil(perfilParam) ? perfilParam : ''
  const statusParam = params.get('status')
  const status = statusParam === 'ativo' || statusParam === 'inativo' ? statusParam : ''
  const pagina = Math.max(1, Number(params.get('pagina')) || 1)

  const alterar = (chave: string, valor: string) => {
    const novo = new URLSearchParams(params)
    if (valor) novo.set(chave, valor)
    else novo.delete(chave)
    if (chave !== 'pagina') novo.delete('pagina')
    setParams(novo, { replace: true })
  }

  const ativosPorPerfil = useMemo(() => contarAtivosPorPerfil(db.usuarios), [db.usuarios])
  const totalAtivos = db.usuarios.filter((u) => u.ativo).length
  const filtrados = useMemo(() => ordenarUsuarios(filtrarUsuarios(db.usuarios, { q, perfil, status })), [db.usuarios, q, perfil, status])

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA))
  const paginaAtual = Math.min(pagina, totalPaginas)
  const visiveis = filtrados.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA)

  // Ações que a regra impede (o próprio usuário, o último administrador) nem aparecem no menu.
  const itensMenu = (u: Usuario): ItemMenu[] => {
    const itens: ItemMenu[] = [
      { rotulo: 'Editar cadastro', icone: <Pencil size={15} aria-hidden />, onSelecionar: () => navigate(`/usuarios/${u.id}`) },
    ]
    if (u.ativo && PERFIS.some((p) => !impedimentoAlterarPerfil(u, p.perfil, executorId, db.usuarios) && p.perfil !== u.papel)) {
      itens.push({ rotulo: 'Alterar perfil', icone: <UserCog size={15} aria-hidden />, onSelecionar: () => setEditandoPerfil(u) })
    }
    if (u.ativo) {
      itens.push({
        rotulo: 'Redefinir senha',
        icone: <KeyRound size={15} aria-hidden />,
        onSelecionar: () => setConfirmacao({ tipo: 'senha', usuario: u }),
      })
    }
    if (!u.ativo) {
      itens.push({
        rotulo: 'Reativar',
        icone: <UserCheck size={15} aria-hidden />,
        onSelecionar: () => setConfirmacao({ tipo: 'status', usuario: u }),
      })
    } else if (!impedimentoInativar(u, executorId, db.usuarios)) {
      itens.push({
        rotulo: 'Inativar',
        icone: <UserX size={15} aria-hidden />,
        perigoso: true,
        onSelecionar: () => setConfirmacao({ tipo: 'status', usuario: u }),
      })
    }
    return itens
  }

  const confirmar = async () => {
    if (!confirmacao) return
    const { tipo, usuario: alvo } = confirmacao
    setProcessando(true)
    try {
      if (tipo === 'senha') {
        const { email } = await redefinirSenha(alvo.id, executorId)
        notificar(`Link de redefinição de senha enviado para ${email}.`)
      } else {
        await alterarStatusUsuario(alvo.id, !alvo.ativo, executorId)
        notificar(alvo.ativo ? `${alvo.nome} foi inativado.` : `${alvo.nome} foi reativado.`)
      }
      setConfirmacao(null)
    } catch (e) {
      notificar(e instanceof Error ? e.message : 'Não foi possível concluir a ação.', 'erro')
    } finally {
      setProcessando(false)
    }
  }

  const alvo = confirmacao?.usuario
  const dialogoConfirmacao =
    confirmacao?.tipo === 'senha'
      ? {
          titulo: `Redefinir a senha de ${alvo?.nome}?`,
          descricao: `Enviaremos para ${alvo?.email} um link para criar uma nova senha. A senha atual continua valendo até lá.`,
          texto: processando ? 'Enviando…' : 'Enviar link',
          perigoso: false,
        }
      : alvo?.ativo
        ? {
            titulo: `Inativar ${alvo.nome}?`,
            descricao:
              'O usuário perde o acesso imediatamente, inclusive a sessão aberta. Reservas, propostas e vendas em que ele é responsável continuam como estão.',
            texto: processando ? 'Inativando…' : 'Inativar',
            perigoso: true,
          }
        : {
            titulo: `Reativar ${alvo?.nome ?? ''}?`,
            descricao: 'O usuário volta a entrar no sistema com a mesma senha e o mesmo perfil.',
            texto: processando ? 'Reativando…' : 'Reativar',
            perigoso: false,
          }

  return (
    <>
      <header className="cabecalho">
        <div>
          <h1 className="cabecalho__titulo">Usuários e permissões</h1>
          <p className="cabecalho__subtitulo">
            {totalAtivos} {totalAtivos === 1 ? 'usuário ativo' : 'usuários ativos'} · senhas armazenadas com hash seguro
          </p>
        </div>
        <div className="cabecalho__acoes">
          <Link to="/usuarios/acessos" className="btn btn--secundario">
            Log de acessos
          </Link>
          <button type="button" className="btn btn--primario" onClick={() => setConvidando(true)}>
            <Plus size={16} /> Convidar usuário
          </button>
        </div>
      </header>

      <main className="conteudo pilha">
        <div className="perfis" role="group" aria-label="Usuários ativos por perfil">
          {PERFIS.map((p) => {
            const selecionado = perfil === p.perfil
            return (
              <button
                key={p.perfil}
                type="button"
                className={`card perfil-card ${selecionado ? 'perfil-card--ativo' : ''}`}
                aria-pressed={selecionado}
                onClick={() => alterar('perfil', selecionado ? '' : p.perfil)}
              >
                <span className="perfil-card__topo">
                  <strong>{p.perfil}</strong>
                  <span className="perfil-card__total">{ativosPorPerfil.get(p.perfil) ?? 0}</span>
                </span>
                <span className="perfil-card__descricao">{p.descricao}</span>
              </button>
            )
          })}
        </div>

        <section className="card" aria-label="Usuários">
          <div className="filtros">
            <div className="busca busca--larga">
              <Search size={15} className="busca__icone" aria-hidden />
              <input
                type="search"
                className="busca__input"
                placeholder="Nome ou e-mail"
                aria-label="Buscar usuários"
                value={q}
                onChange={(e) => alterar('q', e.target.value)}
              />
            </div>
            <select className="input select" aria-label="Perfil" value={perfil} onChange={(e) => alterar('perfil', e.target.value)}>
              <option value="">Todos os perfis</option>
              {PERFIS.map((p) => (
                <option key={p.perfil} value={p.perfil}>
                  {p.perfil}
                </option>
              ))}
            </select>
            <select className="input select" aria-label="Status" value={status} onChange={(e) => alterar('status', e.target.value)}>
              {FILTROS_STATUS.map((f) => (
                <option key={f.valor} value={f.valor}>
                  {f.rotulo}
                </option>
              ))}
            </select>
            {(q || perfil || status) && (
              <button type="button" className="link" onClick={() => setParams({}, { replace: true })}>
                Limpar filtros
              </button>
            )}
          </div>

          {visiveis.length === 0 ? (
            <p className="card__vazio">
              {db.usuarios.length === 0 ? 'Nenhum usuário cadastrado ainda.' : 'Nenhum usuário encontrado com esses filtros.'}
            </p>
          ) : (
            <div className="tabela-wrap">
              <table className="tabela tabela--clicavel">
                <thead>
                  <tr>
                    <th>Usuário</th>
                    <th>E-mail</th>
                    <th>Perfil</th>
                    <th>Último acesso</th>
                    <th>Status</th>
                    <th>
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((u) => (
                    <tr key={u.id} className={u.ativo ? undefined : 'usuario--inativo'} onClick={() => navigate(`/usuarios/${u.id}`)}>
                      <td>
                        <span className="usuario-celula">
                          <span className="avatar" aria-hidden>
                            {iniciais(u.nome)}
                          </span>
                          <Link to={`/usuarios/${u.id}`} className="tabela__destaque" onClick={(e) => e.stopPropagation()}>
                            {u.nome}
                          </Link>
                          {u.id === logado?.id && <span className="usuario-celula__voce">você</span>}
                        </span>
                      </td>
                      <td>{u.email}</td>
                      <td>
                        <Badge variante="perfil">{u.papel}</Badge>
                      </td>
                      <td>{u.ativo || u.ultimoAcesso ? formatarUltimoAcesso(u.ultimoAcesso, agora) : '—'}</td>
                      <td>
                        <Badge variante={u.ativo ? 'normal' : 'neutro'}>{u.ativo ? 'Ativo' : 'Inativo'}</Badge>
                      </td>
                      <td className="tabela__acoes" onClick={(e) => e.stopPropagation()}>
                        <MenuAcoes rotulo={`Ações de ${u.nome}`} itens={itensMenu(u)} />
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

        <MatrizPermissoes />
      </main>

      <ConviteDialogo
        aberto={convidando}
        executorId={executorId}
        emailsExistentes={db.usuarios.map((u) => u.email)}
        onFechar={() => setConvidando(false)}
      />
      <PerfilDialogo usuario={editandoPerfil} executorId={executorId} onFechar={() => setEditandoPerfil(null)} />
      <Dialogo
        aberto={confirmacao !== null}
        titulo={dialogoConfirmacao.titulo}
        descricao={dialogoConfirmacao.descricao}
        textoConfirmar={dialogoConfirmacao.texto}
        perigoso={dialogoConfirmacao.perigoso}
        carregando={processando}
        onCancelar={() => setConfirmacao(null)}
        onConfirmar={confirmar}
      />
    </>
  )
}
