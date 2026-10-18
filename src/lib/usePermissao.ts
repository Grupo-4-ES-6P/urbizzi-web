import { useAuth } from '../contexts/AuthContext'
import { useDb } from '../data/db'
import type { Permissao } from '../data/types'
import { pode } from './permissoes'

/** Se o usuário logado tem a permissão na matriz em vigor; o perfil vem do cadastro, não da sessão gravada. */
export function usePermissao(permissao: Permissao) {
  const { usuario } = useAuth()
  const { permissoes } = useDb()
  return pode(usuario, permissao, permissoes)
}
