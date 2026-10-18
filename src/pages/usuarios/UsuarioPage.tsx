import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Badge, Campo, Spinner, Toggle } from '../../components/ui'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useDb } from '../../data/db'
import type { Usuario } from '../../data/types'
import { PERFIS, PERMISSOES, pode } from '../../lib/permissoes'
import { useAgora } from '../../lib/useAgora'
import {
  ehPerfil,
  formatarUltimoAcesso,
  impedimentoAlterarPerfil,
  impedimentoInativar,
  RESULTADO_ACESSO,
  validarCadastroUsuario,
} from '../../lib/usuarios'
import { atualizarUsuario, type DadosCadastroUsuario } from '../../services/usuarios'
import { dataHora } from '../propostas/proposta'

const ULTIMOS_ACESSOS = 10

export function UsuarioPage() {
  const { id } = useParams()
  const db = useDb()
  const usuario = db.usuarios.find((u) => u.id === id)

  if (!usuario) {
    return (
      <main className="conteudo">
        <section className="card vazio">
          <h2>Usuário não encontrado</h2>
          <Link to="/usuarios" className="btn btn--secundario">
            Voltar para usuários
          </Link>
        </section>
      </main>
    )
  }
  // A key recria o formulário com os dados salvos ao trocar de usuário.
  return <CadastroUsuario key={usuario.id} usuario={usuario} />
}

const dadosDe = (u: Usuario): DadosCadastroUsuario => ({ nome: u.nome, papel: u.papel, ativo: u.ativo })

function CadastroUsuario({ usuario }: Readonly<{ usuario: Usuario }>) {
  const db = useDb()
  const { usuario: logado } = useAuth()
  const notificar = useToast()
  const agora = useAgora()
  const [form, setForm] = useState<DadosCadastroUsuario>(() => dadosDe(usuario))
  const [tentou, setTentou] = useState(false)
  const [salvando, setSalvando] = useState(false)

  const executorId = logado?.id ?? ''
  const proprio = usuario.id === executorId
  const erroNome = tentou ? validarCadastroUsuario(form).nome : undefined
  const sujo = JSON.stringify(form) !== JSON.stringify(dadosDe(usuario))
  // O que a regra impede aparece desabilitado, com o motivo (o próprio usuário, o último administrador).
  const outroPerfil = usuario.papel === 'Administrador' ? 'Corretor' : 'Administrador'
  const bloqueioPerfil = impedimentoAlterarPerfil(usuario, outroPerfil, executorId, db.usuarios)
  const bloqueioStatus = usuario.ativo ? impedimentoInativar(usuario, executorId, db.usuarios) : null
  const descricaoPerfil = PERFIS.find((p) => p.perfil === form.papel)?.descricao
  const permitidas = PERMISSOES.filter((r) => pode({ papel: form.papel }, r.permissao, db.permissoes))
  const acessos = db.acessos
    .filter((a) => a.usuarioId === usuario.id)
    .sort((a, b) => b.data.localeCompare(a.data))
    .slice(0, ULTIMOS_ACESSOS)
  const conviteAberto = usuario.senha === ''

  const salvar = async () => {
    setTentou(true)
    if (validarCadastroUsuario(form).nome) return
    setSalvando(true)
    try {
      await atualizarUsuario(usuario.id, form, executorId)
      notificar('Cadastro do usuário atualizado.')
      setTentou(false)
    } catch (e) {
      notificar(e instanceof Error ? e.message : 'Não foi possível salvar o usuário.', 'erro')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <>
      <header className="cabecalho">
        <div>
          <nav className="migalhas" aria-label="Você está em">
            <Link to="/usuarios">Usuários</Link>
            <span aria-hidden>›</span>
            <span>{usuario.nome}</span>
          </nav>
          <h1 className="cabecalho__titulo">{usuario.nome}</h1>
          <p className="cabecalho__subtitulo">
            {usuario.email} · {usuario.ativo ? 'Ativo' : 'Inativo'}
            {proprio && ' · você'}
          </p>
        </div>
        <div className="cabecalho__acoes">
          <Link to="/usuarios" className="btn btn--secundario">
            Voltar
          </Link>
          <button type="button" className="btn btn--primario" onClick={salvar} disabled={salvando || !sujo}>
            {salvando && <Spinner />} Salvar alterações
          </button>
        </div>
      </header>

      <main className="conteudo pilha">
        <section className="card secao">
          <div className="secao__cabecalho">
            <h2 className="card__titulo">Dados do usuário</h2>
            <p className="card__subtitulo">Perfil e status valem na hora, inclusive para uma sessão já aberta.</p>
          </div>
          <div className="grade">
            <Campo rotulo="Nome completo" erro={erroNome} className="c-4">
              {(p) => <input {...p} className="input" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />}
            </Campo>
            <Campo rotulo="E-mail" dica="É o login do usuário e não pode ser alterado." className="c-4">
              {(p) => <input {...p} className="input" readOnly value={usuario.email} />}
            </Campo>
            <Campo rotulo="Perfil" dica={bloqueioPerfil ?? descricaoPerfil} className="c-4">
              {(p) => (
                <select
                  {...p}
                  className="input select"
                  value={form.papel}
                  disabled={bloqueioPerfil !== null}
                  onChange={(e) => ehPerfil(e.target.value) && setForm({ ...form, papel: e.target.value })}
                >
                  {PERFIS.map((opcao) => (
                    <option key={opcao.perfil} value={opcao.perfil}>
                      {opcao.perfil}
                    </option>
                  ))}
                </select>
              )}
            </Campo>
          </div>
          <div className="toggles usuario__status">
            <Toggle
              rotulo="Usuário ativo"
              ativo={form.ativo}
              desabilitado={bloqueioStatus !== null}
              onChange={(ativo) => setForm({ ...form, ativo })}
            />
          </div>
          <p className="nota-regra">
            {bloqueioStatus ?? 'Inativo não consegue entrar; reservas, propostas e vendas em que ele é responsável continuam como estão.'}
          </p>
        </section>

        <section className="card secao">
          <div className="secao__cabecalho">
            <h2 className="card__titulo">O que o perfil {form.papel} pode fazer</h2>
            <p className="card__subtitulo">Segundo a matriz de permissões em vigor; altere a matriz na tela de usuários.</p>
          </div>
          {permitidas.length === 0 ? (
            <p className="card__vazio">Este perfil não tem nenhuma permissão: só consegue visualizar.</p>
          ) : (
            <ul className="usuario__permissoes">
              {permitidas.map((r) => (
                <li key={r.permissao}>{r.rotulo}</li>
              ))}
            </ul>
          )}
        </section>

        <section className="card" aria-labelledby="acessos-titulo">
          <div className="card__cabecalho">
            <div>
              <h2 id="acessos-titulo" className="card__titulo">
                Acessos
              </h2>
              <p className="card__subtitulo">
                Último acesso: {formatarUltimoAcesso(usuario.ultimoAcesso, agora)}
                {conviteAberto && ' · convite enviado, aguardando a definição da senha'}
              </p>
            </div>
            <Link to={`/usuarios/acessos?q=${encodeURIComponent(usuario.email)}`} className="link">
              Ver no log de acessos
            </Link>
          </div>
          {acessos.length === 0 ? (
            <p className="card__vazio">Nenhuma tentativa de login registrada para este usuário.</p>
          ) : (
            <div className="tabela-wrap">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Data e hora</th>
                    <th>Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {acessos.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <time dateTime={a.data}>{dataHora(a.data)}</time>
                      </td>
                      <td>
                        <Badge variante={RESULTADO_ACESSO[a.resultado].variante}>{RESULTADO_ACESSO[a.resultado].rotulo}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  )
}
