import { screen, within } from '@testing-library/react'

import { lerDb } from '../../data/db'
import { renderizar } from '../../test/utils'

const universitario = () => lerDb().loteamentos.find((l) => l.nome === 'Lot. Universitário')!
const quadra04 = () => lerDb().quadras.find((q) => q.loteamento === universitario().nome && q.identificacao === '04')!

describe('Página de detalhes da quadra', () => {
  it('mostra a planta da quadra e os dados do lote clicado', async () => {
    const lot = universitario()
    const qd = quadra04()
    const { user } = renderizar(`/imoveis/loteamentos/${lot.id}/quadras/${qd.id}`)

    expect(await screen.findByRole('heading', { name: `Qd. 04 — ${lot.nome}` })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Lote 12, Qd. 04 — Reservado' }))

    const painel = screen.getByRole('heading', { name: 'Lote selecionado — Lote 12, Qd. 04' }).closest('section')!
    expect(within(painel).getByText('Marina Alves')).toBeInTheDocument()
    expect(within(painel).getByText(/RES-\d{4}-0184/)).toBeInTheDocument()
  })

  it('avisa quando a quadra não existe', async () => {
    const lot = universitario()
    renderizar(`/imoveis/loteamentos/${lot.id}/quadras/inexistente`)
    expect(await screen.findByRole('heading', { name: 'Quadra não encontrada' })).toBeInTheDocument()
  })

  it('a listagem de quadras do loteamento leva até a página de detalhes', async () => {
    const lot = universitario()
    const { user } = renderizar(`/imoveis/loteamentos/${lot.id}`)

    await user.click(screen.getByRole('link', { name: 'Qd. 04' }))
    expect(await screen.findByRole('heading', { name: `Qd. 04 — ${lot.nome}` })).toBeInTheDocument()
  })
})
