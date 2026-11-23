import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import { AuthProvider } from '../contexts/AuthContext'
import { TemaProvider } from '../contexts/TemaContext'
import { ToastProvider } from '../contexts/ToastContext'
import { lerDb } from '../data/db'
import { PERMISSOES_PADRAO, type Perfil } from '../data/permissoes'
import { Rotas } from '../App'
import { paraUsuarioPublico } from '../services/api'

/** `usuarioId` troca o usuário logado (padrão: o administrador, usr-1). */
export function renderizar(rota: string, { logado = true, usuarioId = 'usr-1' } = {}) {
  if (logado) {
    const usuario = lerDb().usuarios.find((u) => u.id === usuarioId)!
    const permissoes = Object.entries(PERMISSOES_PADRAO)
      .filter(([, perfis]) => perfis.includes(usuario.papel as Perfil))
      .map(([id]) => id.toUpperCase())
    sessionStorage.setItem(
      'urbizzi:sessao',
      JSON.stringify({ token: `token-${usuario.id}`, usuario: paraUsuarioPublico(usuario), permissoes }),
    )
  }
  const user = userEvent.setup()
  const resultado = render(
    <MemoryRouter initialEntries={[rota]}>
      <TemaProvider>
        <ToastProvider>
          <AuthProvider>
            <Rotas />
          </AuthProvider>
        </ToastProvider>
      </TemaProvider>
    </MemoryRouter>,
  )
  return { user, ...resultado }
}
