import { screen, within } from '@testing-library/react'

import { lerDb } from '../../data/db'
import { renderizar } from '../../test/utils'

describe('Lista de propostas', () => {
  it('lista as propostas e abre o detalhe ao clicar', async () => {
    const proposta = lerDb().propostas[0]
    const { user } = renderizar('/propostas')
    expect(screen.getByRole('heading', { level: 1, name: 'Propostas' })).toBeInTheDocument()
    expect(screen.queryByText('Tela em construção')).not.toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: proposta.codigo }))
    expect(await screen.findByRole('link', { name: 'Ver histórico de versões' })).toBeInTheDocument()
  })

  it('filtra por situação e por busca', async () => {
    const { user } = renderizar('/propostas')
    const tabela = () => screen.getByRole('table')
    const total = within(tabela()).getAllByRole('row').length - 1
    expect(total).toBe(lerDb().propostas.length)

    await user.selectOptions(screen.getByLabelText('Situação'), 'Aprovada')
    expect(screen.getByText('Nenhuma proposta encontrada com esses filtros.')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Situação'), 'Em análise')
    const codigo = lerDb().propostas[2].codigo
    await user.type(screen.getByLabelText('Buscar propostas'), codigo)
    const linhas = within(tabela()).getAllByRole('row').slice(1)
    expect(linhas).toHaveLength(1)
    expect(within(linhas[0]).getByText(codigo)).toBeInTheDocument()
  })

  it('a versão da linha leva ao histórico de versões', async () => {
    const proposta = lerDb().propostas.find((p) => (p.versoes?.length ?? 0) > 0)!
    const { user } = renderizar('/propostas')
    await user.click(screen.getByRole('link', { name: 'v3' }))
    expect(await screen.findByRole('heading', { level: 1, name: `${proposta.codigo} — Versões` })).toBeInTheDocument()
  })
})

describe('Menu do site público', () => {
  it.each(['/inicio', '/empreendimentos', '/financiamento', '/contato'])('%s abre o catálogo em vez do login', (rota) => {
    renderizar(rota, { logado: false })
    expect(screen.queryByRole('button', { name: /Entrar/ })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Empreendimento')).toBeInTheDocument()
  })
})
