import { screen, within } from '@testing-library/react'

import { lerDb } from '../../data/db'
import { renderizar } from '../../test/utils'

const universitario = () => lerDb().loteamentos.find((l) => l.nome === 'Lot. Universitário')!

describe('Loteamentos', () => {
  it('gera uma quadra com lotes em série e matrícula pendente', async () => {
    const lot = universitario()
    const antes = lerDb().imoveis.length
    const { user } = renderizar(`/imoveis/loteamentos/${lot.id}/quadras/nova`)

    await user.type(screen.getByLabelText('Testada para'), 'Rua Guaraní')
    const quantidade = screen.getByLabelText('Quantidade de lotes')
    await user.clear(quantidade)
    await user.type(quantidade, '6')
    await user.click(screen.getByRole('button', { name: 'Gerar 6 lotes' }))

    expect(await screen.findByRole('heading', { name: 'Imóveis' })).toBeInTheDocument()
    const novos = lerDb().imoveis.slice(antes)
    expect(novos).toHaveLength(6)
    expect(novos.every((i) => i.endereco.quadra === '07' && i.matricula === '')).toBe(true)
    expect(lerDb().quadras.some((q) => q.loteamento === lot.nome && q.identificacao === '07')).toBe(true)
  })

  it('valida o cadastro de loteamento e salva', async () => {
    const { user } = renderizar('/imoveis/loteamentos/novo')
    await user.click(screen.getByRole('button', { name: /Salvar loteamento/ }))
    expect(screen.getByText('Informe o nome do loteamento.')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Nome do loteamento'), 'Residencial Aurora')
    await user.type(screen.getByLabelText('Código'), 'aur')
    await user.type(screen.getByLabelText('CEP'), '85900')
    await user.type(screen.getByLabelText('Endereço'), 'Rua das Flores, 100')
    await user.type(screen.getByLabelText('Cidade'), 'Toledo')
    await user.click(screen.getByRole('button', { name: /Salvar loteamento/ }))
    expect(screen.getByText('CEP deve ter 8 dígitos.')).toBeInTheDocument()
  })

  it('mapa mostra os dados do lote clicado', async () => {
    const { user } = renderizar(`/imoveis/loteamentos/${universitario().id}/mapa`)
    await user.click(screen.getByRole('button', { name: 'Lote 12, Qd. 04 — Reservado' }))
    const painel = screen.getByRole('heading', { name: 'Lote selecionado — Lote 12, Qd. 04' }).closest('section')!
    expect(within(painel).getByText('Marina Alves')).toBeInTheDocument()
    expect(within(painel).getByText(/RES-\d{4}-0184/)).toBeInTheDocument()
  })
})
