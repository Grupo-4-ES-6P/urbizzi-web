import { screen } from '@testing-library/react'

import { lerDb } from '../../data/db'
import { renderizar } from '../../test/utils'

const universitario = () => lerDb().loteamentos.find((l) => l.nome === 'Lot. Universitário')!

describe('Edição de loteamento cadastrado', () => {
  it('clicar no loteamento da listagem abre o cadastro com os dados preenchidos', async () => {
    const lot = universitario()
    const { user } = renderizar('/imoveis/loteamentos')
    await user.click(screen.getByRole('link', { name: lot.nome }))

    expect(await screen.findByRole('heading', { level: 1, name: lot.nome })).toBeInTheDocument()
    expect(screen.queryByText('Tela em construção')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Nome do loteamento')).toHaveValue(lot.nome)
    expect(screen.getByLabelText('Código')).toHaveValue(lot.codigo)
    expect(screen.getByRole('button', { name: /Salvar alterações/ })).toBeInTheDocument()
  })

  it('altera e salva os dados do loteamento', async () => {
    const lot = universitario()
    const { user } = renderizar(`/loteamentos/${lot.id}`)
    const cartorio = screen.getByLabelText('Cartório de registro')
    await user.clear(cartorio)
    await user.type(cartorio, '2º Ofício de Toledo')
    await user.click(screen.getByRole('button', { name: /Salvar alterações/ }))

    expect(await screen.findByText('Loteamento atualizado.')).toBeInTheDocument()
    expect(lerDb().loteamentos.find((l) => l.id === lot.id)!.cartorio).toBe('2º Ofício de Toledo')
  })

  it('avisa quando o loteamento não existe', () => {
    renderizar('/loteamentos/nao-existe')
    expect(screen.getByRole('heading', { name: 'Loteamento não encontrado' })).toBeInTheDocument()
  })
})
