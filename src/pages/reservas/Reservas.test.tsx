import { fireEvent, screen, within } from '@testing-library/react'

import { lerDb } from '../../data/db'
import { formatarData } from '../../lib/reservas'
import { renderizar } from '../../test/utils'

const linhas = () => within(screen.getByRole('table')).getAllByRole('row').slice(1)

describe('Lista de reservas', () => {
  it('mostra contadores por situação e o alerta de vencimento', async () => {
    renderizar('/reservas')
    const total = lerDb().reservas.length

    expect(screen.getByRole('button', { name: `Todas ${total}` })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Ativas 28' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'A vencer 2' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Expiradas 4' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Convertidas 6' })).toBeInTheDocument()
    expect(screen.getByText('2 reservas vencem nas próximas 48 horas')).toBeInTheDocument()
    expect(linhas()).toHaveLength(total)
  })

  it('"Ver reservas críticas" filtra as que vencem antes, com a mais urgente no topo', async () => {
    const { user } = renderizar('/reservas')
    await user.click(screen.getByRole('button', { name: 'Ver reservas críticas' }))

    expect(screen.getByRole('button', { name: 'A vencer 2' })).toHaveAttribute('aria-pressed', 'true')
    const [primeira, segunda] = linhas()
    expect(primeira).toHaveTextContent('Lote 12 — Qd. 04 · Lot. Universitário')
    expect(within(primeira).getByText('Crítico')).toBeInTheDocument()
    expect(within(segunda).getByText('Atenção')).toBeInTheDocument()
  })

  it('busca por corretor, imóvel ou cliente ignorando acentos e maiúsculas', async () => {
    const { user } = renderizar('/reservas')
    const busca = screen.getByRole('searchbox', { name: 'Buscar reservas' })

    await user.type(busca, 'kruger')
    expect(linhas().length).toBeGreaterThan(0)
    expect(linhas().every((l) => l.textContent?.includes('D. Krüger'))).toBe(true)

    await user.clear(busca)
    await user.type(busca, 'MARINA alves')
    expect(linhas()[0]).toHaveTextContent('Lote 12 — Qd. 04')

    await user.clear(busca)
    await user.type(busca, 'inexistente')
    expect(screen.getByText('Nenhuma reserva encontrada para "inexistente".')).toBeInTheDocument()
    expect(screen.getByText('2 reservas vencem nas próximas 48 horas')).toBeInTheDocument()
  })

  it('abre o detalhe ao clicar na reserva', async () => {
    const { user } = renderizar('/reservas')
    const codigo = lerDb().reservas[0].codigo
    await user.click(screen.getByRole('link', { name: `Detalhes da reserva ${codigo}` }))
    expect(await screen.findByRole('heading', { name: `Reserva ${codigo}` })).toBeInTheDocument()
  })
})

describe('Nova reserva', () => {
  it('valida os campos obrigatórios', async () => {
    const { user } = renderizar('/reservas/nova')
    const antes = lerDb().reservas.length
    await user.click(screen.getByRole('button', { name: 'Criar reserva' }))

    expect(screen.getByText('Selecione o loteamento.')).toBeInTheDocument()
    expect(screen.getByText('Selecione um cliente cadastrado.')).toBeInTheDocument()
    expect(screen.getByText('Selecione o responsável comercial.')).toBeInTheDocument()
    expect(lerDb().reservas).toHaveLength(antes)
  })

  it('impede reservar um imóvel que já tem reserva ativa', async () => {
    const { user } = renderizar('/reservas/nova')
    await user.selectOptions(screen.getByLabelText('Loteamento'), 'Lot. Universitário')
    await user.selectOptions(screen.getByLabelText('Quadra / Lote'), 'Qd. 04 — Lote 12 (Reservado)')

    expect(screen.getByLabelText('Situação atual')).toHaveValue('Reservado')
    expect(screen.getByText('Já existe uma reserva ativa para este imóvel.')).toBeInTheDocument()
  })

  it('sugere a validade pelo prazo do imóvel e calcula a expiração', async () => {
    const alvo = lerDb().imoveis.find((i) => i.loteamento === 'Jd. Europa' && i.situacao === 'disponivel')!
    const { user } = renderizar('/reservas/nova')
    await user.selectOptions(screen.getByLabelText('Loteamento'), 'Jd. Europa')
    await user.selectOptions(screen.getByLabelText('Quadra / Lote'), alvo.id)

    expect(screen.getByLabelText('Validade (dias)')).toHaveValue(3)
    expect(screen.getByLabelText('Renovações permitidas')).toHaveValue('1')

    fireEvent.change(screen.getByLabelText('Data inicial'), { target: { value: '2026-08-26' } })
    const validade = screen.getByLabelText('Validade (dias)')
    await user.clear(validade)
    await user.type(validade, '15')
    expect(screen.getByLabelText('Expira em')).toHaveValue(formatarData('2026-09-10'))
  })

  it('cria a reserva com o cliente do cadastro e bloqueia o imóvel', async () => {
    const alvo = lerDb().imoveis.find((i) => i.loteamento === 'Jd. Europa' && i.situacao === 'disponivel')!
    const { user } = renderizar('/reservas/nova')
    await user.selectOptions(screen.getByLabelText('Loteamento'), 'Jd. Europa')
    await user.selectOptions(screen.getByLabelText('Quadra / Lote'), alvo.id)
    await user.selectOptions(screen.getByLabelText('Cliente'), 'Marina Alves')
    expect(screen.getByLabelText('CPF / CNPJ')).toHaveValue(lerDb().clientes[0].cpfCnpj)
    await user.selectOptions(screen.getByLabelText('Responsável comercial'), 'J. Biló')
    await user.click(screen.getByRole('button', { name: 'Criar reserva' }))

    expect(await screen.findByRole('heading', { name: /^Reserva RES-\d{4}-0185$/ })).toBeInTheDocument()
    const criada = lerDb().reservas.at(-1)!
    expect(criada).toMatchObject({ imovelId: alvo.id, clienteId: 'cli-1', corretorId: 'cor-1', status: 'ativa', validadeDias: 3 })
    expect(criada.historico[0].autor).toBe('Ayran Bade')
    expect(lerDb().imoveis.find((i) => i.id === alvo.id)?.situacao).toBe('reservado')
  })

  it('pede confirmação antes de descartar campos preenchidos', async () => {
    const { user } = renderizar('/reservas/nova')
    await user.selectOptions(screen.getByLabelText('Cliente'), 'Marina Alves')
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    const dialogo = screen.getByRole('dialog')
    await user.click(within(dialogo).getByRole('button', { name: 'Continuar editando' }))
    expect(screen.getByLabelText('Cliente')).toHaveValue('cli-1')

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Descartar' }))
    expect(await screen.findByRole('heading', { name: 'Reservas' })).toBeInTheDocument()
  })
})

describe('Detalhe da reserva', () => {
  const reservaDoLote12 = () => lerDb().reservas[0]

  it('renova a reserva e registra no histórico', async () => {
    const reserva = reservaDoLote12()
    const { user } = renderizar(`/reservas/${reserva.id}`)

    await user.click(screen.getByRole('button', { name: 'Renovar reserva' }))
    expect(screen.getByText('Informe a justificativa da renovação.')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Justificativa'), 'Aguardando aprovação de crédito')
    await user.click(screen.getByRole('button', { name: 'Renovar reserva' }))

    expect(await screen.findByText(/^Reserva renovada até/)).toBeInTheDocument()
    expect(lerDb().reservas[0].renovacoesUsadas).toBe(1)
    expect(screen.getByRole('cell', { name: '+15 dias · Aguardando aprovação de crédito' })).toBeInTheDocument()
  })

  it('cancela após confirmação e libera o imóvel', async () => {
    const reserva = reservaDoLote12()
    const { user } = renderizar(`/reservas/${reserva.id}`)

    await user.click(screen.getByRole('button', { name: 'Cancelar reserva' }))
    expect(screen.getByText('Selecione o motivo do cancelamento.')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Motivo do cancelamento'), 'Crédito não aprovado')
    await user.click(screen.getByRole('button', { name: 'Cancelar reserva' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar reserva' }))

    expect(await screen.findByText('Reserva cancelada. O imóvel voltou para Disponível.')).toBeInTheDocument()
    expect(lerDb().reservas[0].status).toBe('cancelada')
    expect(lerDb().imoveis.find((i) => i.id === reserva.imovelId)?.situacao).toBe('disponivel')
    expect(screen.getByRole('link', { name: 'Voltar' })).toBeInTheDocument()
  })
})
