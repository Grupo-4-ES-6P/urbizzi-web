import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { lerDb } from '../../data/db'
import { renderizar } from '../../test/utils'

const universitario = () => lerDb().loteamentos.find((l) => l.nome === 'Lot. Universitário')!

describe('Cadastro de quadra', () => {
  it('cria a quadra com os lotes em série e abre a página da quadra', async () => {
    const lot = universitario()
    const quadras = lerDb().quadras.filter((q) => q.loteamento === lot.nome).length
    const imoveis = lerDb().imoveis.length
    const { user } = renderizar(`/loteamentos/${lot.id}/quadras/nova`)

    expect(screen.getByRole('heading', { name: `Nova quadra — ${lot.nome}` })).toBeInTheDocument()
    await user.type(screen.getByRole('textbox', { name: 'Identificação da quadra' }), '20')
    await user.type(screen.getByRole('textbox', { name: 'Testada para' }), 'Rua Guaraní')
    await user.clear(screen.getByRole('spinbutton', { name: 'Quantidade de lotes' }))
    await user.type(screen.getByRole('spinbutton', { name: 'Quantidade de lotes' }), '4')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Situação do lote 02' }), 'bloqueado')
    await user.click(screen.getByRole('button', { name: 'Gerar 4 lotes' }))

    expect(await screen.findByRole('heading', { name: `Qd. 20 — ${lot.nome}` })).toBeInTheDocument()
    const db = lerDb()
    expect(db.quadras.filter((q) => q.loteamento === lot.nome)).toHaveLength(quadras + 1)
    expect(db.imoveis).toHaveLength(imoveis + 4)
    const lote02 = db.imoveis.find((i) => i.loteamento === lot.nome && i.endereco.quadra === '20' && i.endereco.lote === '02')
    expect(lote02?.situacao).toBe('bloqueado')
    expect(lote02?.endereco.logradouro).toBe('Rua Guaraní')
  })

  it('impede criar quadra repetida ou sem rua de frente', async () => {
    const lot = universitario()
    const quadras = lerDb().quadras.length
    const { user } = renderizar(`/loteamentos/${lot.id}/quadras/nova`)

    await user.type(screen.getByRole('textbox', { name: 'Identificação da quadra' }), '04')
    await user.click(screen.getByRole('button', { name: /^Gerar/ }))

    expect(screen.getByText('A Qd. 04 já existe neste loteamento.')).toBeInTheDocument()
    expect(screen.getByText('Informe a rua de frente.')).toBeInTheDocument()
    expect(lerDb().quadras).toHaveLength(quadras)
  })

  it('a página da quadra leva até o cadastro de uma nova quadra', async () => {
    const lot = universitario()
    const qd = lerDb().quadras.find((q) => q.loteamento === lot.nome)!
    const { user } = renderizar(`/loteamentos/${lot.id}/quadras/${qd.id}`)

    await user.click(await screen.findByRole('link', { name: 'Nova quadra' }))
    expect(screen.getByRole('heading', { name: `Nova quadra — ${lot.nome}` })).toBeInTheDocument()
  })
})
