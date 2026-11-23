import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { lerDb, restaurarDemo } from '../../data/db'
import { renderizar } from '../../test/utils'

describe('Detalhe da proposta', () => {
  beforeEach(() => restaurarDemo())

  it('exibe os dados e o histórico da proposta selecionada', () => {
    const db = lerDb()
    const proposta = db.propostas[0]
    const cliente = db.clientes.find((item) => item.id === proposta.clienteId)!
    renderizar(`/propostas/${proposta.id}`)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Lote 31')
    expect(screen.getByText(cliente.nome)).toBeInTheDocument()
    expect(screen.getAllByText(new RegExp(proposta.valor.toLocaleString('pt-BR').replace('.', '\\.'))).length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: 'Fluxo de aprovação' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Histórico' })).toBeInTheDocument()
  })

  it('permite registrar contraproposta e preserva a versão anterior', async () => {
    const proposta = lerDb().propostas[0]
    const { user } = renderizar(`/propostas/${proposta.id}`)

    await user.click(screen.getByRole('button', { name: 'Contraproposta' }))
    await user.type(screen.getByRole('textbox', { name: 'Novo valor' }), '43000000')
    await user.type(screen.getByRole('textbox', { name: 'Justificativa' }), 'Valor negociado com o cliente.')
    await user.click(screen.getByRole('button', { name: 'Registrar contraproposta' }))

    await waitFor(() => expect(lerDb().propostas.find((item) => item.id === proposta.id)?.valor).toBe(430000))
    const atualizada = lerDb().propostas.find((item) => item.id === proposta.id)!
    expect(atualizada.versao).toBe(2)
    expect(atualizada.versoes?.[0].valor).toBe(proposta.valor)
    expect(lerDb().historico.some((evento) => evento.referencia === proposta.codigo && evento.tipo === 'Contraproposta')).toBe(true)
  })

  it('solicita justificativa antes de recusar a proposta', async () => {
    const proposta = lerDb().propostas[0]
    const { user } = renderizar(`/propostas/${proposta.id}`)

    await user.click(screen.getByRole('button', { name: 'Recusar proposta' }))
    const dialogo = within(screen.getByRole('dialog'))
    expect(dialogo.getByRole('button', { name: 'Recusar proposta' })).toBeDisabled()
    await user.type(screen.getByRole('textbox', { name: 'Justificativa' }), 'Condições não aceitas.')
    await user.click(dialogo.getByRole('button', { name: 'Recusar proposta' }))

    await waitFor(() => expect(lerDb().propostas.find((item) => item.id === proposta.id)?.status).toBe('recusada'))
  })

  it('confirma a aprovação e registra a venda', async () => {
    const proposta = lerDb().propostas[0]
    const { user } = renderizar(`/propostas/${proposta.id}`)

    await user.click(screen.getByRole('button', { name: 'Aprovar proposta' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar aprovação' }))

    await waitFor(() => expect(lerDb().propostas.find((item) => item.id === proposta.id)?.status).toBe('aprovada'))
    expect(lerDb().vendas.some((venda) => venda.propostaId === proposta.id)).toBe(true)
  })

  it('abre o detalhe ao clicar na proposta exibida no dashboard', async () => {
    const proposta = lerDb().propostas[0]
    const { user } = renderizar('/dashboard')
    const secao = screen.getByRole('heading', { name: 'Propostas aguardando aprovação' }).closest('section')!
    const link = within(secao).getByRole('link', { name: /Lote 31/ })
    expect(link).toHaveAttribute('href', `/propostas/${proposta.id}`)
    await user.click(link)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Lote 31')
  })

  it('mostra um estado claro para identificador desconhecido', () => {
    renderizar('/propostas/inexistente')
    expect(screen.getByRole('heading', { name: 'Proposta não encontrada' })).toBeInTheDocument()
  })
})
