import { screen, waitFor, within } from '@testing-library/react'

import { notificacoesDaApiFalsa } from '../test/apiFalsa'
import { renderizar } from '../test/utils'

function aviso(id: string, idUsuario: string, extra: Partial<(typeof notificacoesDaApiFalsa)[number]> = {}) {
  notificacoesDaApiFalsa.push({
    id,
    idUsuario,
    tipo: 'proposta_pendente',
    titulo: `Aviso ${id}`,
    mensagem: `Mensagem ${id}`,
    link: null,
    lida: false,
    criadaEm: new Date(Date.now() - Number(id) * 60_000).toISOString(),
    ...extra,
  })
}

describe('Notificações', () => {
  it('mostra o contador no menu e só as notificações do próprio usuário', async () => {
    aviso('1', 'usr-1')
    aviso('2', 'usr-1', { lida: true })
    aviso('3', 'usr-2')
    renderizar('/notificacoes')

    const menu = screen.getByRole('link', { name: /Notificações/ })
    expect(await within(menu).findByLabelText('1 não lidas')).toBeInTheDocument()
    expect(await screen.findByText('Aviso 1')).toBeInTheDocument()
    expect(screen.getByText('Aviso 2')).toBeInTheDocument()
    expect(screen.queryByText('Aviso 3')).not.toBeInTheDocument()
  })

  it('abrir uma notificação marca como lida e leva para a tela do link', async () => {
    aviso('1', 'usr-1', { titulo: 'Proposta aguardando análise', link: '/vendas' })
    const { user } = renderizar('/notificacoes')

    await user.click(await screen.findByRole('button', { name: /Proposta aguardando análise/ }))

    expect(await screen.findByRole('heading', { name: 'Vendas' })).toBeInTheDocument()
    expect(notificacoesDaApiFalsa[0].lida).toBe(true)
    await waitFor(() => expect(within(screen.getByRole('link', { name: /Notificações/ })).queryByLabelText(/não lidas/)).toBeNull())
  })

  it('marca todas como lidas e filtra as não lidas', async () => {
    aviso('1', 'usr-1')
    aviso('2', 'usr-1')
    const { user } = renderizar('/notificacoes')
    expect(await screen.findByText('2 não lidas')).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: 'Só não lidas' }))
    await user.click(screen.getByRole('button', { name: /Marcar todas como lidas/ }))

    expect(await screen.findByText('Nenhuma notificação não lida.')).toBeInTheDocument()
    expect(screen.getByText('0 não lidas')).toBeInTheDocument()
  })
})
