import { screen, within } from '@testing-library/react'

import { lerDb } from '../data/db'
import { renderizar } from '../test/utils'

describe('Dashboard', () => {
  it('mostra as reservas mais próximas do vencimento', () => {
    renderizar('/dashboard')
    const tabela = screen.getByRole('table')
    const linhas = within(tabela).getAllByRole('row').slice(1)
    expect(linhas).toHaveLength(5)
    expect(linhas[0]).toHaveTextContent('Lote 12 — Qd. 04 · Lot. Universitário')
    expect(within(linhas[0]).getByText('Crítico')).toBeInTheDocument()
  })

  it('aprova uma proposta e registra a venda', async () => {
    const { user } = renderizar('/dashboard')
    const vendasAntes = lerDb().vendas.length
    const botoes = screen.getAllByRole('button', { name: /^Aprovar proposta/ })
    expect(botoes).toHaveLength(3)

    await user.click(botoes[0])

    expect(await screen.findByText(/aprovada\. Venda de/)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Aprovar proposta/ })).toHaveLength(2)
    expect(lerDb().vendas).toHaveLength(vendasAntes + 1)
  })

  it('recusa uma proposta após confirmação', async () => {
    const { user } = renderizar('/dashboard')
    await user.click(screen.getAllByRole('button', { name: /^Recusar proposta/ })[0])
    await user.type(screen.getByLabelText('Motivo (opcional)'), 'Abaixo do mínimo')
    await user.click(screen.getByRole('button', { name: 'Recusar proposta' }))

    expect(await screen.findByText(/recusada\./)).toBeInTheDocument()
    const recusada = lerDb().propostas.find((p) => p.status === 'recusada')
    expect(recusada?.motivoRecusa).toBe('Abaixo do mínimo')
  })
})
