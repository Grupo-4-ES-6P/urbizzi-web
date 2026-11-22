import { perfilDaApi } from '../data/permissoes'
import type { UsuarioPublico } from '../data/types'
import { http } from './http'

interface LoginResposta {
  accessToken: string
  usuario: { id: string; nome: string; email: string; perfil: string; permissoes: string[] }
}

export interface Sessao {
  token: string
  usuario: UsuarioPublico
  permissoes: string[]
}

export async function entrarNaApi(email: string, senha: string): Promise<Sessao> {
  const { accessToken, usuario } = await http<LoginResposta>('/auth/login', {
    method: 'POST',
    body: { email: email.trim(), senha },
  })
  return {
    token: accessToken,
    usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: perfilDaApi(usuario.perfil) },
    permissoes: usuario.permissoes,
  }
}

/** `exp` do JWT já passou? Token sem `exp` legível conta como válido. */
export function tokenExpirado(token: string, agora = Date.now()) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload.exp === 'number' && payload.exp * 1000 <= agora
  } catch {
    return false
  }
}
