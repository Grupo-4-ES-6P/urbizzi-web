import { MoreHorizontal, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Dialogo } from '../../components/Dialogo'
import { Badge } from '../../components/ui'
import { useToast } from '../../contexts/ToastContext'
import { useDb } from '../../data/db'
import {
  ABREVIACAO_PERFIL,
  DESCRICAO_PERFIL,
  PERFIS,
  PERMISSAO_TRAVADA,
  PERMISSOES,
  VARIANTE_PERFIL,
  type Perfil,
} from '../../data/permissoes'
import type { Usuario } from '../../data/types'
import { iniciais } from '../../lib/format'
import { formatarUltimoAcesso } from '../../lib/ultimoAcesso'
import { alternarPermissao, matrizPermissoes } from '../../services/usuariosPermissoes'

const ativo = (u: Usuario) => u.ativo !== false
const varianteDoPerfil = (papel: string) => VARIANTE_PERFIL[papel as Perfil] ?? 'neutro'

export function UsuariosPermissoesPage() {
  const db = useDb()
  const navigate = useNavigate()
  const notificar = useToast()
  const [logAberto, setLogAberto] = useState(false)

  const ativos = db.usuarios.filter(ativo)
  const matriz = matrizPermissoes(db)
  const porAcesso = [...db.usuarios].sort((a, b) => (b.ultimoAcesso ?? '').localeCompare(a.ultimoAcesso ?? ''))

  const alternar = (permissao: string, perfil: Perfil) => {
    try {
      alternarPermissao(permissao, perfil)
      notificar('Permissão atualizada.')
    } catch (error_) {
      notificar(error_ instanceof Error ? error_.message : 'Não foi possível alterar a permissão.', 'erro')
    }
  }

  return (
    <>
      <header className="cabecalho">
        <div>
          <h1 className="cabecalho__titulo">Usuários e permissões</h1>
          <p className="cabecalho__subtitulo">
            {ativos.length} {ativos.length === 1 ? 'usuário ativo' : 'usuários ativos'} · acesso controlado por perfil · RF34
          </p>
        </div>
        <div className="cabecalho__acoes">
          <button type="button" className="btn btn--secundario" onClick={() => setLogAberto(true)}>
            Log de acessos
          </button>
          <Link to="/usuarios/novo" className="btn btn--primario">
            <Plus size={16} aria-hidden /> Convidar usuário
          </Link>
        </div>
      </header>

      <main className="conteudo pilha">
        <section className="kpis kpis--sem-margem" aria-label="Usuários por perfil">
          {PERFIS.map((perfil) => (
            <article key={perfil} className="card perfil-resumo">
              <div className="perfil-resumo__topo">
                <strong>{perfil}</strong>
                <span className="perfil-resumo__total">{ativos.filter((u) => u.papel === perfil).length}</span>
              </div>
              <span className="perfil-resumo__descricao">{DESCRICAO_PERFIL[perfil]}</span>
            </article>
          ))}
        </section>

        <section className="card">
          <div className="tabela-wrap">
            <table className="tabela tabela--clicavel">
              <thead>
                <tr>
                  <th>Usuário</th><th>E-mail</th><th>Perfil</th><th>Último acesso</th><th>Status</th>
                  <th><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {db.usuarios.map((u) => (
                  <tr key={u.id} onClick={() => navigate(`/usuarios/${u.id}`)}>
                    <td>
                      <span className="usuario-celula">
                        <span className="avatar" aria-hidden>{iniciais(u.nome)}</span>
                        <span className="tabela__destaque">{u.nome}</span>
                      </span>
                    </td>
                    <td>{u.email}</td>
                    <td><Badge variante={varianteDoPerfil(u.papel)}>{u.papel}</Badge></td>
                    <td>{formatarUltimoAcesso(u.ultimoAcesso)}</td>
                    <td><Badge variante={ativo(u) ? 'normal' : 'escuro'}>{ativo(u) ? 'Ativo' : 'Inativo'}</Badge></td>
                    <td>
                      <Link
                        to={`/usuarios/${u.id}`}
                        className="btn btn--icone"
                        aria-label={`Editar ${u.nome}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal size={16} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="card__cabecalho">
            <div>
              <h2 className="card__titulo">Matriz de permissões</h2>
              <p className="card__subtitulo">Define o que cada perfil pode executar no sistema. Clique para liberar ou bloquear.</p>
            </div>
          </div>
          <div className="tabela-wrap">
            <table className="tabela matriz-permissoes">
              <thead>
                <tr>
                  <th>Permissão</th>
                  {PERFIS.map((p) => <th key={p} className="matriz-permissoes__perfil">{ABREVIACAO_PERFIL[p]}</th>)}
                </tr>
              </thead>
              <tbody>
                {PERMISSOES.map((permissao) => (
                  <tr key={permissao.id}>
                    <td>{permissao.rotulo}</td>
                    {PERFIS.map((perfil) => {
                      const liberado = (matriz[permissao.id] ?? []).includes(perfil)
                      const travado = permissao.id === PERMISSAO_TRAVADA && perfil === 'Administrador'
                      return (
                        <td key={perfil} className="matriz-permissoes__perfil">
                          <button
                            type="button"
                            className={`matriz-permissoes__celula ${liberado ? 'matriz-permissoes__celula--sim' : ''}`}
                            aria-pressed={liberado}
                            aria-label={`${ABREVIACAO_PERFIL[perfil]}: ${permissao.rotulo}`}
                            disabled={travado}
                            onClick={() => alternar(permissao.id, perfil)}
                          >
                            {liberado ? <span className="matriz-permissoes__ponto" /> : '—'}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <Dialogo
        aberto={logAberto}
        titulo="Log de acessos"
        textoConfirmar="Fechar"
        semCancelar
        largo
        onConfirmar={() => setLogAberto(false)}
        onCancelar={() => setLogAberto(false)}
      >
        <div className="tabela-wrap">
          <table className="tabela">
            <thead>
              <tr><th>Usuário</th><th>Perfil</th><th>Último acesso</th></tr>
            </thead>
            <tbody>
              {porAcesso.map((u) => (
                <tr key={u.id}>
                  <td>{u.nome}</td>
                  <td>{u.papel}</td>
                  <td>{formatarUltimoAcesso(u.ultimoAcesso)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Dialogo>
    </>
  )
}
