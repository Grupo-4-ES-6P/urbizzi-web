import { screen, within } from '@testing-library/react'

import { atualizarDb, lerDb } from '../../data/db'
import { renderizar } from '../../test/utils'

describe('Relatórios', () => {
  it('mostra os indicadores e a lista de relatórios gerados', () => {
    renderizar('/relatorios')
    expect(screen.getByRole('heading', { level: 1, name: 'Relatórios' })).toBeInTheDocument()
    expect(screen.queryByText('Tela em construção')).not.toBeInTheDocument()
    const kpis = screen.getByRole('region', { name: 'Indicadores do período' })
    expect(within(kpis).getByText('Vendas no período')).toBeInTheDocument()
    expect(within(kpis).getByText('Conversão de reservas')).toBeInTheDocument()
    expect(screen.getByText('Auditoria de cancelamentos')).toBeInTheDocument()
  })

  it('gera um novo relatório pelo diálogo', async () => {
    const { user } = renderizar('/relatorios')
    await user.click(screen.getByRole('button', { name: /Gerar relatório/ }))
    const dialogo = screen.getByRole('dialog')
    await user.selectOptions(within(dialogo).getByLabelText('Relatório'), 'Inventário de imóveis')
    await user.selectOptions(within(dialogo).getByLabelText('Formato'), 'CSV')
    await user.click(within(dialogo).getByRole('button', { name: 'Gerar' }))

    expect(await screen.findByText('Relatório "Inventário de imóveis" gerado em CSV.')).toBeInTheDocument()
    expect(screen.getAllByText('Inventário de imóveis')).toHaveLength(2)
  })

  it('leva para a configuração de notificações', async () => {
    const { user } = renderizar('/relatorios')
    await user.click(screen.getByRole('link', { name: 'Configurar notificações' }))
    expect(await screen.findByRole('heading', { name: 'Configurar notificações' })).toBeInTheDocument()
  })
})

describe('Relatórios — indicadores de reserva', () => {
  it('calcula conversão e tempo médio a partir das reservas convertidas', () => {
    const venda = lerDb().vendas.find((v) => v.status === 'ativa' && new Date(v.data).getFullYear() === new Date().getFullYear())!
    const criada = new Date(new Date(venda.data).getTime() - 10 * 24 * 60 * 60 * 1000)
    atualizarDb((db) => ({
      ...db,
      propostas: [
        ...db.propostas,
        { ...db.propostas[0], id: 'pro-teste', imovelId: venda.imovelId, criadaEm: criada.toISOString(), expiraEm: venda.data, status: 'aprovada' },
      ],
    }))

    renderizar('/relatorios')
    const kpis = screen.getByRole('region', { name: 'Indicadores do período' })
    expect(within(kpis).getByText('reservas que viraram venda')).toBeInTheDocument()
    expect(within(kpis).getByText('10 dias')).toBeInTheDocument()
  })
})
