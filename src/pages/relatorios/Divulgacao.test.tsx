import { screen, within } from '@testing-library/react'

import { lerDb } from '../../data/db'
import { renderizar } from '../../test/utils'

describe('Divulgação e notificações', () => {
  it('gera o endereço público conforme o escopo escolhido', async () => {
    const { user } = renderizar('/relatorios/divulgacao')
    expect(screen.getByRole('heading', { name: 'Divulgação e notificações' })).toBeInTheDocument()

    const primeiro = lerDb().imoveis[0]
    expect(screen.getByLabelText('Endereço gerado')).toHaveValue(`urbizzi.com.br/terrenos/${primeiro.id}`)

    await user.selectOptions(screen.getByLabelText('Escopo'), 'Catálogo inteiro')
    expect(screen.getByLabelText('Endereço gerado')).toHaveValue('urbizzi.com.br/terrenos')
    expect(screen.getByLabelText('Alvo')).toBeDisabled()

    await user.selectOptions(screen.getByLabelText('Escopo'), 'Loteamento')
    const lot = lerDb().loteamentos[0]
    expect(screen.getByLabelText('Endereço gerado')).toHaveValue(`urbizzi.com.br/terrenos?emp=${encodeURIComponent(lot.nome)}`)
  })

  it('ativa e desativa alertas de prazo e salva', async () => {
    const { user } = renderizar('/relatorios/divulgacao')
    const licenca = screen.getByRole('button', { name: 'Licença do loteamento a vencer: inativo' })
    await user.click(licenca)
    expect(screen.getByRole('button', { name: 'Licença do loteamento a vencer: ativo' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('Link e alertas de prazo salvos.')).toBeInTheDocument()
  })

  it('mostra o histórico de envios', async () => {
    const { user } = renderizar('/relatorios/divulgacao')
    await user.click(screen.getByRole('button', { name: /Histórico de envios/ }))
    const dialogo = screen.getByRole('dialog')
    expect(within(dialogo).getAllByText('Reserva a vencer').length).toBeGreaterThan(0)
  })
})
