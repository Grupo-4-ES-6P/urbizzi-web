import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import type { UsuarioPublico } from '../data/types'
import { entrarNaApi, tokenExpirado, type Sessao } from '../services/auth'
import { aoExpirarSessao, definirToken } from '../services/http'

const CHAVE = 'urbizzi:sessao'

interface AuthValor {
  usuario: UsuarioPublico | null
  permissoes: string[]
  pode: (permissao: string) => boolean
  entrar: (email: string, senha: string, manterConectado: boolean) => Promise<void>
  sair: () => void
}

const AuthContext = createContext<AuthValor | null>(null)

function lerSessao(): Sessao | null {
  for (const storage of [localStorage, sessionStorage]) {
    try {
      const bruto = storage.getItem(CHAVE)
      if (!bruto) continue
      const sessao = JSON.parse(bruto) as Partial<Sessao>
      if (sessao.token && sessao.usuario && !tokenExpirado(sessao.token)) {
        return { token: sessao.token, usuario: sessao.usuario, permissoes: sessao.permissoes ?? [] }
      }
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
    const nova = await entrarNaApi(email, senha)
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

  const valor = useMemo(() => {
    const permissoes = sessao?.permissoes ?? []
    return {
      usuario: sessao?.usuario ?? null,
      permissoes,
      pode: (permissao: string) => permissoes.includes('ADMIN') || permissoes.includes(permissao.toUpperCase()),
      entrar,
      sair,
    }
  }, [sessao, entrar, sair])

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return ctx
}
