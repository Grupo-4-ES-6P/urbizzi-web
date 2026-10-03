import { lerDb } from '../data/db'
import { cpfValido, cnpjValido } from '../lib/clienteForm'
import { adicionarDias, dataCalendario } from '../lib/reservas'
import {
  aprovarProposta,
  cancelarReserva,
  criarReserva,
  excluirClientes,
  renovarReserva,
  salvarCliente,
  sincronizarReservas,
  type DadosNovaReserva,
} from './api'

const hoje = () => dataCalendario(new Date())

/** Primeiro lote disponível do loteamento (Jd. Europa permite 1 renovação; Universitário, 2). */
const loteDisponivel = (loteamento = 'Lot. Universitário') =>
  lerDb().imoveis.find((i) => i.loteamento === loteamento && i.situacao === 'disponivel' && i.status === 'publicado')!

function dados(parcial: Partial<DadosNovaReserva> = {}): DadosNovaReserva {
  return {
    imovelId: loteDisponivel().id,
    clienteId: 'cli-1',
    corretorId: 'cor-1',
    dataInicio: hoje(),
    validadeDias: 15,
    avisarHorasAntes: 48,
    sinal: 5000,
    formaPagamento: 'Entrada + 24x',
    descontoPercentual: 3,
    origemInteresse: 'Catálogo público',
    contatoRecente: '',
    observacoes: '',
    ...parcial,
  }
}

const erroDe = async (promessa: Promise<unknown>) => {
  try {
    await promessa
  } catch (e) {
    return (e as Error).message
  }
  return undefined
}

describe('reservas', () => {
  afterEach(() => vi.useRealTimers())

  it('cria a reserva, bloqueia o imóvel e registra no histórico do imóvel', async () => {
    const imovel = loteDisponivel()
    const reserva = await criarReserva(dados({ imovelId: imovel.id }), 'Ayran Bade')

    expect(reserva.codigo).toMatch(/^RES-\d{4}-0185$/)
    expect(reserva.status).toBe('ativa')
    expect(dataCalendario(new Date(reserva.expiraEm))).toBe(adicionarDias(hoje(), 15))
    expect(reserva.renovacoesPermitidas).toBe(2)
    expect(reserva.historico[0]).toMatchObject({ titulo: 'Reserva criada', autor: 'Ayran Bade' })
    expect(reserva.historico[0].detalhe).toMatch(/^Validade de 15 dias · sinal de R\$\s5\.000$/)
    expect(lerDb().imoveis.find((i) => i.id === imovel.id)?.situacao).toBe('reservado')
    expect(lerDb().historico.some((e) => e.imovelId === imovel.id && e.referencia === reserva.codigo)).toBe(true)
  })

  it('bloqueia uma segunda reserva ativa para o mesmo imóvel (RF14)', async () => {
    const reservado = lerDb().reservas.find((r) => r.status === 'ativa')!
    expect(await erroDe(criarReserva(dados({ imovelId: reservado.imovelId }), 'x'))).toBe('Já existe uma reserva ativa para este imóvel.')
  })

  it('só reserva imóveis Disponível (RF13)', async () => {
    const vendido = lerDb().imoveis.find((i) => i.situacao === 'vendido')!
    expect(await erroDe(criarReserva(dados({ imovelId: vendido.id }), 'x'))).toBe(
      'Somente imóveis com situação Disponível podem ser reservados.',
    )
  })

  it('exige um cliente cadastrado e ativo', async () => {
    expect(await erroDe(criarReserva(dados({ clienteId: 'cli-999' }), 'x'))).toBe('Cliente não encontrado.')
    const inativo = lerDb().clientes.find((c) => !c.ativo)!
    expect(await erroDe(criarReserva(dados({ clienteId: inativo.id }), 'x'))).toMatch(/inativo/)
  })

  it('expira reservas com data retroativa já na criação e libera o imóvel (RF16)', async () => {
    const imovel = loteDisponivel()
    const reserva = await criarReserva(dados({ imovelId: imovel.id, dataInicio: adicionarDias(hoje(), -20), validadeDias: 10 }), 'x')

    expect(reserva.status).toBe('expirada')
    expect(reserva.historico.map((e) => e.titulo)).toEqual(['Reserva criada', 'Reserva expirada'])
    expect(lerDb().imoveis.find((i) => i.id === imovel.id)?.situacao).toBe('disponivel')
    expect((await criarReserva(dados({ imovelId: imovel.id }), 'x')).status).toBe('ativa')
  })

  it('expira uma reserva ativa quando o prazo passa', async () => {
    const imovel = loteDisponivel()
    const reserva = await criarReserva(dados({ imovelId: imovel.id, validadeDias: 1 }), 'x')
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(new Date(reserva.expiraEm).getTime() + 60_000))

    sincronizarReservas()

    const atualizada = lerDb().reservas.find((r) => r.id === reserva.id)!
    expect(atualizada.status).toBe('expirada')
    expect(atualizada.historico.at(-1)?.autor).toBe('Sistema')
    expect(lerDb().imoveis.find((i) => i.id === imovel.id)?.situacao).toBe('disponivel')
  })

  it('registra o aviso de vencimento uma única vez dentro da janela', async () => {
    const reserva = await criarReserva(dados({ dataInicio: adicionarDias(hoje(), -14), validadeDias: 15 }), 'x')
    expect(reserva.historico.map((e) => e.titulo)).toEqual(['Reserva criada', 'Aviso de vencimento'])

    sincronizarReservas()
    expect(lerDb().reservas.find((r) => r.id === reserva.id)!.historico).toHaveLength(2)
  })

  it('renova a partir da expiração atual e respeita o limite do loteamento (RF15)', async () => {
    const reserva = await criarReserva(dados({ imovelId: loteDisponivel('Jd. Europa').id }), 'x')

    const renovada = await renovarReserva(reserva.id, { dias: 5, justificativa: 'Aguardando crédito' }, 'Ayran Bade')
    expect(dataCalendario(new Date(renovada.expiraEm))).toBe(adicionarDias(hoje(), 20))
    expect(renovada.renovacoesUsadas).toBe(1)
    expect(renovada.historico.at(-1)).toMatchObject({ titulo: 'Reserva renovada', autor: 'Ayran Bade', detalhe: '+5 dias · Aguardando crédito' })

    expect(await erroDe(renovarReserva(reserva.id, { dias: 5, justificativa: 'De novo' }, 'x'))).toBe(
      'Limite de renovações do loteamento atingido.',
    )
  })

  it('exige justificativa na renovação', async () => {
    const reserva = await criarReserva(dados(), 'x')
    expect(await erroDe(renovarReserva(reserva.id, { dias: 5, justificativa: '  ' }, 'x'))).toBe('Informe a nova validade e a justificativa.')
  })

  it('cancelamento libera o imóvel imediatamente e mantém o histórico', async () => {
    const imovel = loteDisponivel()
    const reserva = await criarReserva(dados({ imovelId: imovel.id }), 'x')

    const cancelada = await cancelarReserva(reserva.id, { motivo: 'Desistência do cliente', detalhamento: '' }, 'x')
    expect(cancelada.status).toBe('cancelada')
    expect(cancelada.historico.map((e) => e.titulo)).toEqual(['Reserva criada', 'Reserva cancelada'])
    expect(lerDb().imoveis.find((i) => i.id === imovel.id)?.situacao).toBe('disponivel')
    expect(await erroDe(renovarReserva(reserva.id, { dias: 5, justificativa: 'x' }, 'x'))).toBe('Somente reservas ativas podem ser alteradas.')
  })

  it('aprovar a proposta converte a reserva e registra no histórico dela', async () => {
    const proposta = lerDb().propostas.find((p) => p.status === 'pendente' && lerDb().imoveis.find((i) => i.id === p.imovelId)?.matricula)!
    const reserva = lerDb().reservas.find((r) => r.imovelId === proposta.imovelId && r.status === 'ativa')!

    await aprovarProposta(proposta.id)

    const convertida = lerDb().reservas.find((r) => r.id === reserva.id)!
    expect(convertida.status).toBe('convertida')
    expect(convertida.historico.at(-1)?.titulo).toBe('Reserva convertida em venda')
  })
})

describe('clientes', () => {
  it('a base de demonstração tem documentos válidos', () => {
    for (const c of lerDb().clientes) {
      expect(c.tipoPessoa === 'fisica' ? cpfValido(c.cpfCnpj) : cnpjValido(c.cpfCnpj)).toBe(true)
    }
  })

  it('não aceita dois clientes com o mesmo CPF', async () => {
    const { id: _id, criadoEm: _c, atualizadoEm: _a, ...existente } = lerDb().clientes[1]
    void [_id, _c, _a]
    expect(await erroDe(salvarCliente({ ...existente, nome: 'Outra pessoa' }))).toMatch(/^Já existe um cliente com o CPF/)
  })

  it('não exclui clientes com reservas, propostas ou vendas', async () => {
    expect(await erroDe(excluirClientes(['cli-1']))).toMatch(/Desative o cadastro/)
    expect(lerDb().clientes.some((c) => c.id === 'cli-1')).toBe(true)
  })
})
