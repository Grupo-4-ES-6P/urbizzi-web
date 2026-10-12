import { screen, within } from '@testing-library/react'

import { lerDb } from '../../data/db'
import { renderizar } from '../../test/utils'

describe('Catálogo público', () => {
  it('lista só terrenos disponíveis e publicados, sem exigir login', () => {
    renderizar('/terrenos', { logado: false })
    const esperados = lerDb().imoveis.filter((i) => i.status === 'publicado' && i.publicacao.catalogo && i.situacao === 'disponivel')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(`${esperados.length} terrenos em Toledo — PR`)
  })

  it('filtra por empreendimento ao clicar em Buscar', async () => {
    const { user } = renderizar('/terrenos', { logado: false })
    await user.selectOptions(screen.getByLabelText('Empreendimento'), 'Jd. Europa')
    await user.click(screen.getByRole('button', { name: 'Buscar' }))
    const cards = screen.getAllByRole('button', { name: 'Tenho interesse' })
    const esperados = lerDb().imoveis.filter((i) => i.loteamento === 'Jd. Europa' && i.situacao === 'disponivel' && i.publicacao.catalogo)
    expect(cards.length).toBe(Math.min(10, esperados.length))
  })

  it('registra interesse pela página do terreno', async () => {
    const imovel = lerDb().imoveis.find((i) => i.situacao === 'disponivel' && i.publicacao.catalogo)!
    const { user } = renderizar(`/terrenos/${imovel.id}`, { logado: false })
    await user.click(screen.getByRole('button', { name: 'Tenho interesse' }))
    const dialogo = screen.getByRole('dialog')
    await user.click(within(dialogo).getByRole('button', { name: 'Enviar interesse' }))
    expect(within(dialogo).getByText('Informe nome e sobrenome.')).toBeInTheDocument()

    await user.type(within(dialogo).getByLabelText('Nome completo'), 'Marina Ferreira Duarte')
    await user.type(within(dialogo).getByLabelText('E-mail'), 'marina@email.com')
    await user.type(within(dialogo).getByLabelText('Telefone'), '45998124477')
    await user.click(within(dialogo).getByRole('button', { name: 'Enviar interesse' }))

    expect(await screen.findByText('Interesse enviado!')).toBeInTheDocument()
    expect(lerDb().interesses.some((i) => i.imovelId === imovel.id && i.nome === 'Marina Ferreira Duarte')).toBe(true)
  })

  it('não mostra terreno vendido', () => {
    const vendido = lerDb().imoveis.find((i) => i.situacao === 'vendido')!
    renderizar(`/terrenos/${vendido.id}`, { logado: false })
    expect(screen.getByRole('heading', { name: 'Terreno indisponível' })).toBeInTheDocument()
  })
})
