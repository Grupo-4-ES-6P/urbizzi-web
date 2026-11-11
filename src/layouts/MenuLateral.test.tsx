import { screen, within } from '@testing-library/react'

import { renderizar } from '../test/utils'

it('barra lateral segue a ordem combinada e não tem mais Reservas', () => {
  renderizar('/dashboard')
  const menu = screen.getByRole('complementary', { name: 'Menu principal' })
  const itens = within(menu).getAllByRole('link').map((l) => l.textContent?.trim())
  expect(itens).toEqual(['Dashboard', 'Imóveis', 'Loteamentos', 'Propostas', 'Vendas', 'Relatórios', 'Clientes', 'Usuários'])
})
