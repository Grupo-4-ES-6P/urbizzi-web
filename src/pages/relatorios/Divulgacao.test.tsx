import { screen, within } from '@testing-library/react'

import { renderizar } from '../../test/utils'

describe('Configurar notificações', () => {
  it('lista os alertas que o sistema dispara e leva para as notificações', async () => {
    const { user } = renderizar('/relatorios/notificacoes')
    const tabela = screen.getByRole('table')
    expect(within(tabela).getByText('Reserva perto de vencer')).toBeInTheDocument()
    expect(within(tabela).getByText('Novo interesse pelo site')).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: /Minhas notificações/ }))
    expect(await screen.findByRole('heading', { name: 'Notificações' })).toBeInTheDocument()
  })
})
