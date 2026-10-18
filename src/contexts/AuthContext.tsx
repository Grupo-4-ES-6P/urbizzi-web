import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

import { useDb } from '../data/db'
import type { UsuarioPublico } from '../data/types'
import { autenticar, paraUsuarioPublico } from '../services/api'

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
  const db = useDb()
  const [sessao, setSessao] = useState<UsuarioPublico | null>(lerSessao)

  // A sessão guarda só a identidade; perfil e status vêm sempre do cadastro. Assim, quem é
  // inativado sai na hora e uma troca de perfil vale sem novo login. Comparar o e-mail
  // descarta sessões de uma versão anterior do banco em que o mesmo id era outra pessoa.
  const usuario = useMemo(() => {
    const atual = sessao && db.usuarios.find((u) => u.id === sessao.id && u.email === sessao.email)
    return atual?.ativo ? paraUsuarioPublico(atual) : null
  }, [db.usuarios, sessao])

  const entrar = useCallback(async (email: string, senha: string, manterConectado: boolean) => {
    const u = await autenticar(email, senha)
    limparSessao()
    try {
      // "Manter conectado" sobrevive ao fechamento do navegador; caso contrário, só à aba.
      ;(manterConectado ? localStorage : sessionStorage).setItem(CHAVE, JSON.stringify(u))
    } catch {
      // Sem persistência, a sessão dura até recarregar a página.
    }
    setSessao(u)
  }, [])

  const sair = useCallback(() => {
    limparSessao()
    setSessao(null)
  }, [])

  const valor = useMemo(() => ({ usuario, entrar, sair }), [usuario, entrar, sair])
  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return ctx
}
