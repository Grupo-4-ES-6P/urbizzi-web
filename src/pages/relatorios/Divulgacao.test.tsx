import { screen, within } from '@testing-library/react'

import { lerDb } from '../../data/db'
import { configDaApiFalsa, notificacoesDaApiFalsa } from '../../test/apiFalsa'
import { renderizar } from '../../test/utils'

const config = (tipo: string) => configDaApiFalsa.find((c) => c.tipo === tipo)!

describe('Configurar notificações', () => {
  it('liga, desliga e muda canal e antecedência, gravando na API', async () => {
    const { user } = renderizar('/relatorios/notificacoes')
    const tabela = await screen.findByRole('table')
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled()

    await user.click(within(tabela).getByRole('button', { name: 'Novo interesse pelo site: ativo' }))
    await user.click(within(tabela).getByRole('checkbox', { name: 'Também por e-mail: Reserva perto de vencer' }))
    await user.selectOptions(within(tabela).getByLabelText('Antecedência: Reserva perto de vencer'), '24')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('Alertas de prazo salvos.')).toBeInTheDocument()
    expect(config('interesse').ativo).toBe(false)
    expect(config('reserva_vencendo')).toMatchObject({ email: true, antecedenciaHoras: 24 })
    expect(config('reserva_expirada')).toMatchObject({ ativo: true, email: false })
  })

  it('mostra o histórico real de envios', async () => {
    notificacoesDaApiFalsa.push({
      id: '1',
      idUsuario: 'usr-1',
      tipo: 'interesse',
      titulo: 'Novo interesse pelo site',
      mensagem: 'x',
      link: null,
      lida: false,
      criadaEm: new Date().toISOString(),
    })
    const { user } = renderizar('/relatorios/notificacoes')
    await user.click(await screen.findByRole('button', { name: /Histórico de envios/ }))
    const dialogo = await screen.findByRole('dialog')
    expect(within(dialogo).getByText('Novo interesse pelo site')).toBeInTheDocument()
  })

  it('quem não gerencia usuários só consulta', async () => {
    const gerente = lerDb().usuarios.find((u) => u.papel === 'Gerente comercial' && u.ativo !== false)!
    renderizar('/relatorios/notificacoes', { usuarioId: gerente.id })
    const tabela = await screen.findByRole('table')
    expect(within(tabela).getByRole('button', { name: 'Novo interesse pelo site: ativo' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Salvar' })).not.toBeInTheDocument()
  })
})
