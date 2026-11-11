import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { Dialogo } from '../../components/Dialogo'
import { Campo, Spinner, Toggle } from '../../components/ui'
import { useToast } from '../../contexts/ToastContext'
import { useDb } from '../../data/db'
import { DESCRICAO_PERFIL, PERFIS, type Perfil } from '../../data/permissoes'
import type { Usuario } from '../../data/types'
import { salvarUsuario, validarUsuario, type ErrosUsuario, type FormUsuario } from '../../services/usuariosPermissoes'
import { formatarUltimoAcesso } from '../../lib/ultimoAcesso'

const vazio: FormUsuario = { nome: '', email: '', papel: 'Corretor', ativo: true, senha: '' }

/** Cadastro (/usuarios/novo) e edição (/usuarios/:id) de usuários do painel. */
export function UsuarioFormPage() {
  const { id } = useParams()
  const db = useDb()
  const usuario = id ? db.usuarios.find((u) => u.id === id) : undefined
  if (id && !usuario) {
    return (
      <main className="conteudo">
        <section className="card vazio">
          <h1>Usuário não encontrado</h1>
          <Link to="/usuarios" className="btn btn--secundario">Voltar</Link>
        </section>
      </main>
    )
  }
  return <FormUsuarioTela key={id ?? 'novo'} usuario={usuario} />
}

function FormUsuarioTela({ usuario }: Readonly<{ usuario?: Usuario }>) {
  const db = useDb()
  const navigate = useNavigate()
  const notificar = useToast()
  const [form, setForm] = useState<FormUsuario>(() =>
    usuario
      ? { nome: usuario.nome, email: usuario.email, papel: usuario.papel as Perfil, ativo: usuario.ativo !== false, senha: '' }
      : vazio,
  )
  const [erros, setErros] = useState<ErrosUsuario>({})
  const [sujo, setSujo] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [descartar, setDescartar] = useState(false)

  const alterar = (parcial: Partial<FormUsuario>) => {
    setForm((f) => ({ ...f, ...parcial }))
    setSujo(true)
    setErros((e) => {
      const c = { ...e }
      for (const k of Object.keys(parcial)) delete c[k as keyof FormUsuario]
      return c
    })
  }

  const salvar = async () => {
    const e = validarUsuario(form, usuario?.id, db.usuarios)
    setErros(e)
    if (Object.keys(e).length) {
      notificar('Revise os campos destacados.', 'erro')
      return
    }
    setSalvando(true)
    try {
      await salvarUsuario(form, usuario?.id)
      notificar(usuario ? 'Usuário atualizado.' : `Convite enviado para ${form.email.trim().toLowerCase()}.`)
      navigate('/usuarios')
    } catch (error_) {
      notificar(error_ instanceof Error ? error_.message : 'Não foi possível salvar.', 'erro')
      setSalvando(false)
    }
  }

  const titulo = usuario ? usuario.nome : 'Convidar usuário'

  return (
    <>
      <header className="cabecalho cabecalho--fixo">
        <div>
          <nav className="migalhas" aria-label="Você está em">
            <Link to="/usuarios">Usuários</Link>
            <span aria-hidden>›</span>
            <span>{usuario ? 'Editar usuário' : 'Novo usuário'}</span>
          </nav>
          <h1 className="cabecalho__titulo">{titulo}</h1>
          <p className="cabecalho__subtitulo">
            {usuario ? `Último acesso: ${formatarUltimoAcesso(usuario.ultimoAcesso)}` : 'O perfil define o que a pessoa pode fazer no sistema · RF34'}
          </p>
        </div>
        <div className="cabecalho__acoes">
          <button type="button" className="btn btn--secundario" onClick={() => (sujo ? setDescartar(true) : navigate('/usuarios'))}>
            Cancelar
          </button>
          <button type="button" className="btn btn--primario" onClick={salvar} disabled={salvando}>
            {salvando && <Spinner />} {usuario ? 'Salvar alterações' : 'Enviar convite'}
          </button>
        </div>
      </header>

      <main className="conteudo pilha">
        <section className="card secao">
          <div className="secao__cabecalho">
            <h2 className="card__titulo">Dados de acesso</h2>
            <p className="card__subtitulo">O e-mail é o login da pessoa no painel.</p>
          </div>
          <div className="grade">
            <Campo rotulo="Nome completo" erro={erros.nome} className="c-6">
              {(p) => <input {...p} className="input" autoComplete="off" value={form.nome} onChange={(e) => alterar({ nome: e.target.value })} />}
            </Campo>
            <Campo rotulo="E-mail" erro={erros.email} className="c-6">
              {(p) => <input {...p} type="email" className="input" autoComplete="off" placeholder="nome@urbizzi.com.br" value={form.email} onChange={(e) => alterar({ email: e.target.value })} />}
            </Campo>
            <Campo rotulo="Perfil" erro={erros.papel} dica={DESCRICAO_PERFIL[form.papel]} className="c-4">
              {(p) => (
                <select {...p} className="input select" value={form.papel} onChange={(e) => alterar({ papel: e.target.value as Perfil })}>
                  {PERFIS.map((perfil) => <option key={perfil}>{perfil}</option>)}
                </select>
              )}
            </Campo>
            <Campo
              rotulo={usuario ? 'Nova senha' : 'Senha provisória'}
              erro={erros.senha}
              dica={usuario ? 'Deixe em branco para manter a senha atual.' : 'A pessoa troca no primeiro acesso.'}
              className="c-4"
            >
              {(p) => <input {...p} type="password" className="input" autoComplete="new-password" value={form.senha} onChange={(e) => alterar({ senha: e.target.value })} />}
            </Campo>
            <div className="c-4 grade__botao">
              <Toggle rotulo="Usuário ativo" ativo={form.ativo} onChange={(v) => alterar({ ativo: v })} />
            </div>
          </div>
        </section>
      </main>

      <Dialogo
        aberto={descartar}
        titulo="Descartar alterações?"
        descricao="As informações não salvas serão perdidas."
        textoConfirmar="Descartar"
        textoCancelar="Continuar editando"
        perigoso
        onCancelar={() => setDescartar(false)}
        onConfirmar={() => navigate('/usuarios')}
      />
    </>
  )
}
