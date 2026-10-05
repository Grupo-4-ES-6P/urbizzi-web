import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

import type { UsuarioPublico } from '../data/types'
import { autenticar } from '../services/api'

const CHAVE = 'urbizzi:sessao'

interface AuthValor {
  usuario: UsuarioPublico | null
  entrar: (email: string, senha: string, manterConectado: boolean) => Promise<void>
  sair: () => void
}

const AuthContext = createContext<AuthValor | null>(null)

function lerSessao(): UsuarioPublico | null {
  for (const storage of [localStorage, sessionStorage]) {
    try {
      const bruto = storage.getItem(CHAVE)
      if (bruto) return JSON.parse(bruto) as UsuarioPublico
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
  const [usuario, setUsuario] = useState<UsuarioPublico | null>(lerSessao)

  const entrar = useCallback(async (email: string, senha: string, manterConectado: boolean) => {
    const u = await autenticar(email, senha)
    limparSessao()
    try {
      // "Manter conectado" sobrevive ao fechamento do navegador; caso contrário, só à aba.
      ;(manterConectado ? localStorage : sessionStorage).setItem(CHAVE, JSON.stringify(u))
    } catch {
      // Sem persistência, a sessão dura até recarregar a página.
    }
    setUsuario(u)
  }, [])

  const sair = useCallback(() => {
    limparSessao()
    setUsuario(null)
  }, [])

  const valor = useMemo(() => ({ usuario, entrar, sair }), [usuario, entrar, sair])
  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return ctx
}
