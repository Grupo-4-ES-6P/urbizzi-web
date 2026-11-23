import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { atualizarDb, lerDb, restaurarDemo } from '../../data/db'
import { aprovarProposta } from '../../services/api'
import { renderizar } from '../../test/utils'

describe('Vendas', () => {
  beforeEach(() => restaurarDemo())

  it('lista as vendas com lote, comprador, corretor, valor e status', () => {
    renderizar('/vendas')
    const db = lerDb()
    expect(screen.getByRole('heading', { name: 'Vendas' })).toBeInTheDocument()
    expect(screen.getByText(new RegExp(`${db.vendas.length} vendas registradas`))).toBeInTheDocument()

    const maisRecente = [...db.vendas].sort((a, b) => b.data.localeCompare(a.data))[0]
    const linha = screen.getAllByRole('row')[1]
    expect(within(linha).getByText(db.clientes.find((c) => c.id === maisRecente.clienteId)!.nome)).toBeInTheDocument()
    expect(within(linha).getByText(db.corretores.find((c) => c.id === maisRecente.corretorId)!.nome)).toBeInTheDocument()
    expect(within(linha).getByText('Concluída')).toBeInTheDocument()
    expect(screen.getByText(`1–20 de ${db.vendas.length}`)).toBeInTheDocument()
  })

  it('mostra a venda gerada pela proposta aprovada com o corretor da proposta', async () => {
    const proposta = lerDb().propostas.find((p) => p.status === 'pendente' && lerDb().imoveis.find((i) => i.id === p.imovelId)?.matricula)!
    await aprovarProposta(proposta.id)
    renderizar('/vendas')
    const db = lerDb()
    const linha = screen.getAllByRole('row')[1]
    expect(within(linha).getByText(db.clientes.find((c) => c.id === proposta.clienteId)!.nome)).toBeInTheDocument()
    expect(within(linha).getByText(db.corretores.find((c) => c.id === proposta.corretorId)!.nome)).toBeInTheDocument()
  })

  it('marca vendas canceladas e conta no resumo', () => {
    atualizarDb((db) => ({ ...db, vendas: db.vendas.map((v, i) => (i === 0 ? { ...v, status: 'cancelada' } : v)) }))
    renderizar('/vendas')
    expect(screen.getByText(/1 cancelada$/)).toBeInTheDocument()
  })
})
