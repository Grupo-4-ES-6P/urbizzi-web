import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { lerDb, restaurarDemo } from '../../data/db'
import { renderizar } from '../../test/utils'

describe('Nova proposta', () => {
  beforeEach(() => restaurarDemo())

  it('salva rascunho e envia a mesma proposta para aprovação', async () => {
    const { user } = renderizar('/propostas/nova')
    const db = lerDb()
    const imovel = db.imoveis.find((item) => item.status === 'publicado' && item.situacao === 'disponivel' && !db.propostas.some((proposta) => proposta.imovelId === item.id && proposta.status === 'pendente'))!
    const cliente = db.clientes[0]
    expect(screen.getByRole('heading', { name: 'Nova proposta' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Imóvel' })).toHaveValue('')
    expect(screen.getByRole('textbox', { name: 'Valor proposto' })).toHaveValue('')
    expect(screen.getByRole('textbox', { name: 'Valor proposto' })).toHaveAttribute('placeholder', 'Ex.: 350.000,00')
    expect(screen.getByRole('spinbutton', { name: 'Validade da proposta' })).toHaveAttribute('placeholder', 'Ex.: 7 dias')

    await user.selectOptions(screen.getByRole('combobox', { name: 'Imóvel' }), imovel.id)
    expect(screen.getByRole('combobox', { name: 'Loteamento' })).toHaveValue(imovel.loteamento)
    expect(screen.getByRole('combobox', { name: 'Lote' })).toHaveValue(imovel.id)
    await user.selectOptions(screen.getByRole('combobox', { name: 'Cliente' }), cliente.id)
    await user.type(screen.getByRole('textbox', { name: 'Valor proposto' }), '45000000')
    await user.type(screen.getByRole('textbox', { name: 'Entrada' }), '9000000')
    await user.type(screen.getByRole('spinbutton', { name: 'Parcelas' }), '24')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Índice de correção' }), 'IGP-M')
    fireEvent.change(screen.getByLabelText('Primeiro vencimento'), { target: { value: '2026-11-20' } })
    await user.selectOptions(screen.getByRole('combobox', { name: 'Forma de pagamento' }), 'Entrada + financiamento direto')
    await user.type(screen.getByRole('spinbutton', { name: 'Validade da proposta' }), '7')

    await user.click(screen.getByRole('button', { name: 'Salvar rascunho' }))
    const rascunhos = lerDb().propostas.filter((item) => item.status === 'rascunho')
    expect(rascunhos).toHaveLength(1)
    expect(rascunhos[0].imovelId).toBe(imovel.id)
    expect(rascunhos[0].clienteId).toBe(cliente.id)

    await user.click(screen.getByRole('button', { name: 'Enviar para aprovação' }))
    expect(lerDb().propostas.find((item) => item.id === rascunhos[0].id)?.status).toBe('pendente')
    expect(screen.getByRole('heading', { name: 'Propostas' })).toBeInTheDocument()
  })

  it('mostra o erro do valor e impede o envio', async () => {
    const { user } = renderizar('/propostas/nova')
    const db = lerDb()
    const imovel = db.imoveis.find((item) => item.status === 'publicado' && item.situacao === 'disponivel' && !db.propostas.some((proposta) => proposta.imovelId === item.id && proposta.status === 'pendente'))!
    const quantidade = lerDb().propostas.length
    await user.selectOptions(screen.getByRole('combobox', { name: 'Loteamento' }), imovel.loteamento)
    await user.selectOptions(screen.getByRole('combobox', { name: 'Lote' }), imovel.id)
    expect(screen.getByRole('combobox', { name: 'Imóvel' })).toHaveValue(imovel.id)
    await user.selectOptions(screen.getByRole('combobox', { name: 'Cliente' }), db.clientes[0].id)
    await user.click(screen.getByRole('button', { name: 'Enviar para aprovação' }))

    expect(screen.getByText('Informe um valor maior que zero.')).toBeInTheDocument()
    expect(lerDb().propostas).toHaveLength(quantidade)
  })
})
