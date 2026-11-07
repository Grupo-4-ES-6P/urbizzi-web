import { screen, within } from '@testing-library/react'

import { lerDb } from '../../data/db'
import { visivelNoCatalogo } from '../../data/selectors'
import { renderizar } from '../../test/utils'

describe('Detalhe público do terreno', () => {
  it('mostra ficha técnica, preço e abre o formulário de interesse', async () => {
    const imovel = lerDb().imoveis.find((i) => visivelNoCatalogo(i) && i.situacao === 'disponivel')!
    const { user } = renderizar(`/terrenos/${imovel.id}`, { logado: false })

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(imovel.loteamento)
    expect(screen.getByRole('heading', { name: 'Ficha técnica' })).toBeInTheDocument()
    expect(screen.getByText('Disponível')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Tenho interesse' }))
    expect(within(screen.getByRole('dialog')).getByRole('heading', { name: 'Tenho interesse neste imóvel' })).toBeInTheDocument()
  })

  it('falar com um corretor já preenche a mensagem', async () => {
    const imovel = lerDb().imoveis.find((i) => visivelNoCatalogo(i))!
    const { user } = renderizar(`/terrenos/${imovel.id}`, { logado: false })
    await user.click(screen.getByRole('button', { name: 'Falar com um corretor' }))
    expect(screen.getByLabelText('Mensagem')).toHaveValue('Gostaria de falar com um corretor sobre este terreno.')
  })

  it('terreno vendido mostra aviso de indisponível em vez dos dados comerciais (RF31)', () => {
    const vendido = lerDb().imoveis.find((i) => i.situacao === 'vendido' && i.status === 'publicado')!
    renderizar(`/terrenos/${vendido.id}`, { logado: false })
    expect(screen.getByText('Indisponível')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tenho interesse' })).not.toBeInTheDocument()
  })

  it('o catálogo leva ao detalhe do terreno', async () => {
    const { user } = renderizar('/terrenos', { logado: false })
    const links = screen.getAllByRole('link').filter((l) => /^\/terrenos\/[^/?]+$/.test(l.getAttribute('href') ?? ''))
    await user.click(links[1])
    expect(await screen.findByRole('heading', { name: 'Ficha técnica' })).toBeInTheDocument()
  })
})
