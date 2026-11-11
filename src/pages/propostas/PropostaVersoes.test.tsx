import { screen, waitFor, within } from '@testing-library/react'

import { lerDb } from '../../data/db'
import { renderizar } from '../../test/utils'

const comVersoes = () => lerDb().propostas.find((p) => (p.versoes?.length ?? 0) > 0)!

describe('Versões da proposta', () => {
  it('mostra a versão atual e as anteriores como substituídas', () => {
    const proposta = comVersoes()
    renderizar(`/propostas/${proposta.id}/versoes`)
    expect(screen.getByRole('heading', { level: 1, name: `${proposta.codigo} — Versões` })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Versão atual — v3' })).toBeInTheDocument()
    const historico = screen.getByRole('heading', { name: 'Histórico de versões' }).closest('section')!
    expect(within(historico).getAllByText('Substituída')).toHaveLength(2)
    expect(within(historico).getByText('Versão inicial da proposta')).toBeInTheDocument()
  })

  it('compara duas versões', async () => {
    const { user } = renderizar(`/propostas/${comVersoes().id}/versoes`)
    await user.click(screen.getByRole('button', { name: 'Comparar versões' }))
    const dialogo = screen.getByRole('dialog')
    // Padrão: v2 contra v3 (só o valor mudou).
    expect(within(dialogo).getAllByText('Entrada 30% + 24x')).toHaveLength(2)
    await user.selectOptions(within(dialogo).getByLabelText('Versão A'), 'v1')
    expect(within(dialogo).getByText('Entrada 20% + 18x')).toBeInTheDocument()
  })

  it('registra uma nova versão preservando a anterior', async () => {
    const proposta = lerDb().propostas[0]
    const { user } = renderizar(`/propostas/${proposta.id}/versoes`)
    await user.click(screen.getByRole('button', { name: 'Nova versão' }))
    const valor = screen.getByRole('textbox', { name: 'Novo valor' })
    await user.clear(valor)
    await user.type(valor, '41000000')
    await user.type(screen.getByRole('textbox', { name: 'O que mudou' }), 'Desconto negociado.')
    await user.click(screen.getByRole('button', { name: 'Registrar versão' }))

    await waitFor(() => expect(lerDb().propostas[0].versao).toBe(2))
    expect(lerDb().propostas[0].versoes?.[0].valor).toBe(proposta.valor)
    expect(await screen.findByRole('heading', { name: 'Versão atual — v2' })).toBeInTheDocument()
  })

  it('o detalhe da proposta leva ao histórico de versões', async () => {
    const proposta = comVersoes()
    const { user } = renderizar(`/propostas/${proposta.id}`)
    await user.click(screen.getByRole('link', { name: 'Ver histórico de versões' }))
    expect(await screen.findByRole('heading', { level: 1, name: `${proposta.codigo} — Versões` })).toBeInTheDocument()
  })
})
