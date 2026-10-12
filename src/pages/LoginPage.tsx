import { ArrowLeft, Eye, EyeOff, MailCheck } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'

import { BotaoTema } from '../components/BotaoTema'
import { Logo } from '../components/Logo'
import { Campo, Spinner } from '../components/ui'
import { useAuth } from '../contexts/AuthContext'
import { useDb } from '../data/db'
import { resumoGeral } from '../data/selectors'
import { formatarMoedaCompacta } from '../lib/format'
import { solicitarRecuperacaoSenha } from '../services/api'

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Modo = 'entrar' | 'recuperar' | 'enviado'

export function LoginPage() {
  const db = useDb()
  const resumo = useMemo(() => resumoGeral(db, Date.now()), [db])
  const [modo, setModo] = useState<Modo>('entrar')
  const [email, setEmail] = useState('')

  return (
    <div className="login">
      <aside className="login__painel">
        <Logo comSlogan tamanho="lg" />
        <div className="login__chamada">
          <h1>Gestão completa de loteamentos e terrenos.</h1>
          <p>Cadastre imóveis, controle reservas, acompanhe propostas e registre vendas — tudo em um só painel.</p>
        </div>
        <dl className="login__numeros">
          <div>
            <dt>Imóveis cadastrados</dt>
            <dd>{resumo.imoveisCadastrados}</dd>
          </div>
          <div>
            <dt>Reservas ativas</dt>
            <dd>{resumo.reservasAtivas}</dd>
          </div>
          <div>
            <dt>Vendas no ano</dt>
            <dd>{formatarMoedaCompacta(resumo.vendasNoAno)}</dd>
          </div>
        </dl>
      </aside>

      <main className="login__area">
        <BotaoTema className="login__tema" />
        <div className="login__form-wrap">
          <div className="login__logo-mobile">
            <Logo comSlogan />
          </div>
          {modo === 'entrar' && (
            <FormEntrar email={email} setEmail={setEmail} onEsqueci={() => setModo('recuperar')} />
          )}
          {modo === 'recuperar' && (
            <FormRecuperar
              email={email}
              setEmail={setEmail}
              onVoltar={() => setModo('entrar')}
              onEnviado={() => setModo('enviado')}
            />
          )}
          {modo === 'enviado' && (
            <div className="login__enviado" role="status">
              <MailCheck size={32} aria-hidden />
              <h2 className="login__titulo">Verifique seu e-mail</h2>
              <p className="login__subtitulo">
                Se <strong>{email}</strong> estiver cadastrado, você receberá um link para redefinir a senha em
                alguns minutos.
              </p>
              <button type="button" className="btn btn--primario btn--bloco" onClick={() => setModo('entrar')}>
                Voltar para o login
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

interface FormEntrarProps {
  email: string
  setEmail: (v: string) => void
  onEsqueci: () => void
}

function FormEntrar({ email, setEmail, onEsqueci }: FormEntrarProps) {
  const { entrar } = useAuth()
  const [senha, setSenha] = useState('')
  const [manter, setManter] = useState(true)
  const [verSenha, setVerSenha] = useState(false)
  const [erros, setErros] = useState<{ email?: string; senha?: string }>({})
  const [erroGeral, setErroGeral] = useState('')
  const [enviando, setEnviando] = useState(false)

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    const novos: typeof erros = {}
    if (!email.trim()) novos.email = 'Informe seu e-mail.'
    else if (!EMAIL_VALIDO.test(email.trim())) novos.email = 'E-mail inválido.'
    if (!senha) novos.senha = 'Informe sua senha.'
    setErros(novos)
    setErroGeral('')
    if (Object.keys(novos).length) return

    setEnviando(true)
    try {
      await entrar(email, senha, manter)
      // O redirecionamento acontece em <SomenteVisitante> assim que houver usuário.
    } catch (erro) {
      setErroGeral(erro instanceof Error ? erro.message : 'Não foi possível entrar.')
      setEnviando(false)
    }
  }

  return (
    <form className="login__form" onSubmit={enviar} noValidate>
      <h2 className="login__titulo">Entrar na sua conta</h2>
      <p className="login__subtitulo">Acesse o painel de gestão da Urbizzi.</p>

      {erroGeral && (
        <div className="alerta alerta--erro" role="alert">
          {erroGeral}
        </div>
      )}

      <Campo rotulo="E-mail" erro={erros.email}>
        {(props) => (
          <input
            {...props}
            type="email"
            className="input input--suave"
            placeholder="seunome@urbizzi.com.br"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}
      </Campo>

      <Campo rotulo="Senha" erro={erros.senha}>
        {(props) => (
          <div className="input-adorno input-adorno--suave">
            <input
              {...props}
              type={verSenha ? 'text' : 'password'}
              className="input input--suave"
              placeholder="••••••••••"
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
            <button
              type="button"
              className="input-adorno__botao"
              onClick={() => setVerSenha((v) => !v)}
              aria-label={verSenha ? 'Ocultar senha' : 'Mostrar senha'}
            >
              {verSenha ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        )}
      </Campo>

      <div className="login__linha">
        <label className="checkbox">
          <input type="checkbox" checked={manter} onChange={(e) => setManter(e.target.checked)} />
          Manter conectado
        </label>
        <button type="button" className="link" onClick={onEsqueci}>
          Esqueci minha senha
        </button>
      </div>

      <button type="submit" className="btn btn--primario btn--bloco btn--alto" disabled={enviando}>
        {enviando ? (
          <>
            <Spinner /> Entrando…
          </>
        ) : (
          'Entrar'
        )}
      </button>

      <p className="login__rodape">Não tem acesso? Solicite ao administrador do sistema.</p>
      {import.meta.env.DEV && (
        <p className="login__demo">
          Demonstração: <code>admin@urbizzi.com.br</code> / <code>urbizzi123</code>
        </p>
      )}
    </form>
  )
}

interface FormRecuperarProps {
  email: string
  setEmail: (v: string) => void
  onVoltar: () => void
  onEnviado: () => void
}

function FormRecuperar({ email, setEmail, onVoltar, onEnviado }: FormRecuperarProps) {
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (!EMAIL_VALIDO.test(email.trim())) {
      setErro(email.trim() ? 'E-mail inválido.' : 'Informe seu e-mail.')
      return
    }
    setErro('')
    setEnviando(true)
    await solicitarRecuperacaoSenha(email)
    onEnviado()
  }

  return (
    <form className="login__form" onSubmit={enviar} noValidate>
      <button type="button" className="link link--voltar" onClick={onVoltar}>
        <ArrowLeft size={14} /> Voltar
      </button>
      <h2 className="login__titulo">Recuperar senha</h2>
      <p className="login__subtitulo">Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha.</p>
      <Campo rotulo="E-mail" erro={erro}>
        {(props) => (
          <input
            {...props}
            type="email"
            className="input input--suave"
            placeholder="seunome@urbizzi.com.br"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}
      </Campo>
      <button type="submit" className="btn btn--primario btn--bloco btn--alto" disabled={enviando}>
        {enviando ? (
          <>
            <Spinner /> Enviando…
          </>
        ) : (
          'Enviar link de recuperação'
        )}
      </button>
    </form>
  )
}
