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

  it('lista só as propostas que aguardam o usuário e aprova a última etapa registrando a venda', async () => {
    const { user } = renderizar('/dashboard')
    const vendasAntes = 10
    const botoes = screen.getAllByRole('button', { name: /^Aprovar proposta/ })
    // Lote 31 (diretoria) e Lote 07 (análise comercial); a do Lote 12 aguarda outro gestor.
    expect(botoes).toHaveLength(2)
    expect(botoes[0]).toHaveAccessibleName(/Lote 31/)

    await user.click(botoes[0])

    expect(await screen.findByText(/aprovada\. Venda de R\$\s420\.000 registrada/)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Aprovar proposta/ })).toHaveLength(1)
  })

  it('recusa uma proposta após confirmação', async () => {
    const { user } = renderizar('/dashboard')
    await user.click(screen.getAllByRole('button', { name: /^Recusar proposta/ })[0])
    expect(screen.getByRole('button', { name: 'Recusar proposta' })).toBeDisabled()
    await user.type(screen.getByLabelText('Motivo da recusa'), 'Abaixo do mínimo')
    await user.click(screen.getByRole('button', { name: 'Recusar proposta' }))

    expect(await screen.findByText(/recusada\./)).toBeInTheDocument()
  })
})
