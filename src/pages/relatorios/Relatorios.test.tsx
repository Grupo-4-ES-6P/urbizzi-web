import { screen, within } from '@testing-library/react'

import { restaurarDemo } from '../../data/db'
import { renderizar } from '../../test/utils'

const linhas = () => within(screen.getByRole('table')).getAllByRole('row').slice(1)

beforeEach(() => {
  restaurarDemo()
})

describe('Relatórios', () => {
  it('mostra cabeçalho, indicadores e relatórios gerados', () => {
    renderizar('/relatorios')

    expect(screen.getByRole('heading', { level: 1, name: 'Relatórios' })).toBeInTheDocument()
    expect(screen.getByText('Histórico consolidado do período · exportação em CSV e PDF')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Relatórios' })).toHaveClass('active')

    const indicadores = screen.getByRole('region', { name: 'Indicadores do período' })
    expect(within(indicadores).getByText('R$ 4,2M')).toBeInTheDocument()
    expect(within(indicadores).getByText('17 contratos fechados')).toBeInTheDocument()
    expect(within(indicadores).getByText('24 dias')).toBeInTheDocument()

    expect(screen.getByText('Arquivos ficam disponíveis por 90 dias')).toBeInTheDocument()
    expect(within(screen.getByRole('table')).getAllByRole('columnheader').map((c) => c.textContent)).toEqual([
      'Relatório',
      'Período',
      'Formato',
      'Gerado por',
      'Data',
      'Status',
    ])
    const visiveis = linhas()
    expect(visiveis).toHaveLength(6)
    expect(within(visiveis[0]).getAllByRole('cell').map((c) => c.textContent)).toEqual([
      'Vendas por empreendimento',
      'Jul–Ago 2026',
      'PDF',
      'Ayran Bade',
      '24/08/2026',
      'Pronto',
    ])
    expect(visiveis[4]).toHaveTextContent('Gerando')
  })

  it('só relatórios prontos podem ser abertos; as ações avisam que ainda não existem', async () => {
    const { user } = renderizar('/relatorios')

    expect(within(linhas()[4]).queryByRole('button')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reservas expiradas — baixar CSV' }))
    expect(await screen.findByText('Download de "Reservas expiradas" (CSV) em breve.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Gerar relatório' }))
    expect(await screen.findByText('Geração de relatórios em breve.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Agendar envio' }))
    expect(await screen.findByText('Agendamento de envio em breve.')).toBeInTheDocument()
  })
})
