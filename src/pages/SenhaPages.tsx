import { Eye, EyeOff, KeyRound } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { BotaoTema } from '../components/BotaoTema'
import { Logo } from '../components/Logo'
import { Campo, Spinner } from '../components/ui'
import { useAuth } from '../contexts/AuthContext'
import { redefinirSenha, trocarSenha } from '../services/auth'

const MIN_SENHA = 8

function TelaSimples({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="login login--simples">
      <main className="login__area">
        <BotaoTema className="login__tema" />
        <div className="login__form-wrap">
          <div className="login__logo-mobile">
            <Logo comSlogan />
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}

function CampoSenha({
  rotulo,
  valor,
  setValor,
  erro,
  autoComplete,
}: Readonly<{ rotulo: string; valor: string; setValor: (v: string) => void; erro?: string; autoComplete: string }>) {
  const [ver, setVer] = useState(false)
  return (
    <Campo rotulo={rotulo} erro={erro}>
      {(props) => (
        <div className="input-adorno input-adorno--suave">
          <input
            {...props}
            type={ver ? 'text' : 'password'}
            className="input input--suave"
            autoComplete={autoComplete}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
          <button
            type="button"
            className="input-adorno__botao"
            onClick={() => setVer((v) => !v)}
            aria-label={ver ? `Ocultar ${rotulo.toLowerCase()}` : `Mostrar ${rotulo.toLowerCase()}`}
          >
            {ver ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      )}
    </Campo>
  )
}

interface ErrosNovaSenha {
  atual?: string
  nova?: string
  confirmacao?: string
}

function validarNovaSenha(nova: string, confirmacao: string): ErrosNovaSenha {
  const erros: ErrosNovaSenha = {}
  if (nova.length < MIN_SENHA) erros.nova = `Use pelo menos ${MIN_SENHA} caracteres.`
  if (confirmacao !== nova) erros.confirmacao = 'As senhas não conferem.'
  return erros
}

/** Primeiro acesso: a senha veio do administrador e precisa ser trocada antes de usar o sistema. */
export function TrocarSenhaPage() {
  const { usuario, senhaTrocada, sair } = useAuth()
  const navigate = useNavigate()
  const [atual, setAtual] = useState('')
  const [nova, setNova] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erros, setErros] = useState<ErrosNovaSenha>({})
  const [erroGeral, setErroGeral] = useState('')
  const [enviando, setEnviando] = useState(false)

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    const novos = validarNovaSenha(nova, confirmacao)
    if (!atual) novos.atual = 'Informe a senha atual.'
    else if (atual === nova) novos.nova = 'A nova senha precisa ser diferente da atual.'
    setErros(novos)
    setErroGeral('')
    if (Object.keys(novos).length) return

    setEnviando(true)
    try {
      await trocarSenha(atual, nova)
      senhaTrocada()
      navigate('/dashboard', { replace: true })
    } catch (error_) {
      setErroGeral(error_ instanceof Error ? error_.message : 'Não foi possível trocar a senha.')
      setEnviando(false)
    }
  }

  return (
    <TelaSimples>
      <form className="login__form" onSubmit={enviar} noValidate>
        <KeyRound size={32} aria-hidden />
        <h2 className="login__titulo">Crie sua senha</h2>
        <p className="login__subtitulo">
          Olá, {usuario?.nome}. Sua senha foi definida pelo administrador; troque-a para continuar.
        </p>
        {erroGeral && (
          <div className="alerta alerta--erro" role="alert">
            {erroGeral}
          </div>
        )}
        <CampoSenha rotulo="Senha atual" valor={atual} setValor={setAtual} erro={erros.atual} autoComplete="current-password" />
        <CampoSenha rotulo="Nova senha" valor={nova} setValor={setNova} erro={erros.nova} autoComplete="new-password" />
        <CampoSenha
          rotulo="Confirme a nova senha"
          valor={confirmacao}
          setValor={setConfirmacao}
          erro={erros.confirmacao}
          autoComplete="new-password"
        />
        <button type="submit" className="btn btn--primario btn--bloco btn--alto" disabled={enviando}>
          {enviando ? (
            <>
              <Spinner /> Salvando…
            </>
          ) : (
            'Salvar nova senha'
          )}
        </button>
        <button type="button" className="link" onClick={sair}>
          Sair
        </button>
      </form>
    </TelaSimples>
  )
}

/** Aberta pelo link do e-mail de recuperação (?token=...). */
export function RedefinirSenhaPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [nova, setNova] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erros, setErros] = useState<ErrosNovaSenha>({})
  const [erroGeral, setErroGeral] = useState(token ? '' : 'Link inválido. Peça um novo na tela de login.')
  const [concluido, setConcluido] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    const novos = validarNovaSenha(nova, confirmacao)
    setErros(novos)
    if (Object.keys(novos).length || !token) return

    setErroGeral('')
    setEnviando(true)
    try {
      await redefinirSenha(token, nova)
      setConcluido(true)
    } catch (error_) {
      setErroGeral(error_ instanceof Error ? error_.message : 'Não foi possível redefinir a senha.')
    } finally {
      setEnviando(false)
    }
  }

  if (concluido) {
    return (
      <TelaSimples>
        <div className="login__enviado">
          <KeyRound size={32} aria-hidden />
          <h2 className="login__titulo">Senha redefinida</h2>
          <output className="login__subtitulo">Pronto! Entre com a nova senha.</output>
          <Link to="/login" className="btn btn--primario btn--bloco">
            Ir para o login
          </Link>
        </div>
      </TelaSimples>
    )
  }

  return (
    <TelaSimples>
      <form className="login__form" onSubmit={enviar} noValidate>
        <h2 className="login__titulo">Nova senha</h2>
        <p className="login__subtitulo">Escolha uma senha com pelo menos {MIN_SENHA} caracteres.</p>
        {erroGeral && (
          <div className="alerta alerta--erro" role="alert">
            {erroGeral}
          </div>
        )}
        <CampoSenha rotulo="Nova senha" valor={nova} setValor={setNova} erro={erros.nova} autoComplete="new-password" />
        <CampoSenha
          rotulo="Confirme a nova senha"
          valor={confirmacao}
          setValor={setConfirmacao}
          erro={erros.confirmacao}
          autoComplete="new-password"
        />
        <button type="submit" className="btn btn--primario btn--bloco btn--alto" disabled={enviando || !token}>
          {enviando ? (
            <>
              <Spinner /> Salvando…
            </>
          ) : (
            'Redefinir senha'
          )}
        </button>
        <Link to="/login" className="link">
          Voltar para o login
        </Link>
      </form>
    </TelaSimples>
  )
}
