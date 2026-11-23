import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { PERFIS, type Perfil } from '../data/permissoes'
import type { UsuarioPublico } from '../data/types'
import { entrarNaApi, tokenExpirado, type Sessao } from '../services/auth'
import { aoExpirarSessao, definirToken } from '../services/http'

const CHAVE = 'urbizzi:sessao'

interface AuthValor {
  usuario: UsuarioPublico | null
  permissoes: string[]
  pode: (permissao: string) => boolean
  trocarSenha: boolean
  senhaTrocada: () => void
  entrar: (email: string, senha: string, manterConectado: boolean) => Promise<void>
  sair: () => void
}

const AuthContext = createContext<AuthValor | null>(null)

const TOKEN_VALIDO = /^[\w.-]{1,4096}$/
const PERMISSAO_VALIDA = /^[A-Z0-9_:]{1,64}$/

const texto = (valor: unknown, max: number) => (typeof valor === 'string' ? valor.slice(0, max) : '')

/** Remonta a sessão só com campos válidos; o storage é editável pelo usuário. */
function sessaoValida(valor: unknown): Sessao | null {
  const s = valor as Partial<Sessao> | null
  if (!s || typeof s.token !== 'string' || !TOKEN_VALIDO.test(s.token)) return null
  const u = s.usuario as Partial<UsuarioPublico> | undefined
  if (!u || !PERFIS.includes(u.papel as Perfil)) return null
  return {
    token: s.token,
    usuario: { id: texto(u.id, 64), nome: texto(u.nome, 256), email: texto(u.email, 256), papel: u.papel as Perfil },
    permissoes: Array.isArray(s.permissoes)
      ? s.permissoes.filter((p): p is string => typeof p === 'string' && PERMISSAO_VALIDA.test(p))
      : [],
    trocarSenha: s.trocarSenha === true,
  }
}

function lerSessao(): Sessao | null {
  for (const storage of [localStorage, sessionStorage]) {
    try {
      const bruto = storage.getItem(CHAVE)
      if (!bruto) continue
      const sessao = sessaoValida(JSON.parse(bruto))
      if (sessao && !tokenExpirado(sessao.token)) return sessao
    } catch {
      // Ignora sessão inválida.
    }
  }
  return null
}

function limparSessao() {
  for (const storage of [localStorage, sessionStorage]) {
    try {
      storage.removeItem(CHAVE)
    } catch {
      // Storage indisponível.
    }
  }
}

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [sessao, setSessao] = useState<Sessao | null>(() => {
    const inicial = lerSessao()
    definirToken(inicial?.token ?? null)
    return inicial
  })

  const sair = useCallback(() => {
    limparSessao()
    definirToken(null)
    setSessao(null)
  }, [])

  useEffect(() => aoExpirarSessao(sair), [sair])

  const entrar = useCallback(async (email: string, senha: string, manterConectado: boolean) => {
    const nova = sessaoValida(await entrarNaApi(email, senha))
    if (!nova) throw new Error('Resposta de login inválida.')
    limparSessao()
    try {
      // "Manter conectado" sobrevive ao fechamento do navegador; caso contrário, só à aba.
      ;(manterConectado ? localStorage : sessionStorage).setItem(CHAVE, JSON.stringify(nova))
    } catch {
      // Sem persistência, a sessão dura até recarregar a página.
    }
    definirToken(nova.token)
    setSessao(nova)
  }, [])

  const senhaTrocada = useCallback(() => {
    setSessao((atual) => {
      if (!atual) return atual
      const nova = { ...atual, trocarSenha: false }
      for (const storage of [localStorage, sessionStorage]) {
        try {
          if (storage.getItem(CHAVE)) storage.setItem(CHAVE, JSON.stringify(nova))
        } catch {
          // Storage indisponível.
        }
      }
      return nova
    })
  }, [])

  const valor = useMemo(() => {
    const permissoes = sessao?.permissoes ?? []
    return {
      usuario: sessao?.usuario ?? null,
      permissoes,
      pode: (permissao: string) => permissoes.includes('ADMIN') || permissoes.includes(permissao.toUpperCase()),
      trocarSenha: sessao?.trocarSenha === true,
      senhaTrocada,
      entrar,
      sair,
    }
  }, [sessao, entrar, sair, senhaTrocada])

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return ctx
}
