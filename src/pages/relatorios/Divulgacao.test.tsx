import { screen, within } from '@testing-library/react'

import { renderizar } from '../../test/utils'

describe('Configurar notificações', () => {
  it('ativa e desativa alertas de prazo e salva', async () => {
    const { user } = renderizar('/relatorios/notificacoes')
    const licenca = screen.getByRole('button', { name: 'Licença do loteamento a vencer: inativo' })
    await user.click(licenca)
    expect(screen.getByRole('button', { name: 'Licença do loteamento a vencer: ativo' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('Alertas de prazo salvos.')).toBeInTheDocument()
  })

  it('mostra o histórico de envios', async () => {
    const { user } = renderizar('/relatorios/notificacoes')
    await user.click(screen.getByRole('button', { name: /Histórico de envios/ }))
    const dialogo = screen.getByRole('dialog')
    expect(within(dialogo).getAllByText('Reserva a vencer').length).toBeGreaterThan(0)
  })
})
