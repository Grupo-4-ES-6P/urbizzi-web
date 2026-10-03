import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import { AuthProvider } from '../contexts/AuthContext'
import { TemaProvider } from '../contexts/TemaContext'
import { ToastProvider } from '../contexts/ToastContext'
import { lerDb } from '../data/db'
import { Rotas } from '../App'

export function renderizar(rota: string, { logado = true } = {}) {
  if (logado) {
    const { senha: _s, ...usuario } = lerDb().usuarios[0]
    void _s
    sessionStorage.setItem('urbizzi:sessao', JSON.stringify(usuario))
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
