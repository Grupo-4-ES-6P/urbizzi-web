import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import { AuthProvider } from '../contexts/AuthContext'
import { ToastProvider } from '../contexts/ToastContext'
import { lerDb } from '../data/db'
import { Rotas } from '../App'
import { paraUsuarioPublico } from '../services/api'

export function renderizar(rota: string, { logado = true } = {}) {
  if (logado) {
    sessionStorage.setItem('urbizzi:sessao', JSON.stringify(paraUsuarioPublico(lerDb().usuarios[0])))
  }
  const user = userEvent.setup()
  const resultado = render(
    <MemoryRouter initialEntries={[rota]}>
      <ToastProvider>
        <AuthProvider>
          <Rotas />
        </AuthProvider>
      </ToastProvider>
    </MemoryRouter>,
  )
  return { user, ...resultado }
}
