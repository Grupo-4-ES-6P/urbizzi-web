import { lerDb } from '../data/db'
import { dataCalendario } from '../lib/reservas'
import { cancelarVenda, concluirEscritura, registrarVenda, type DadosVenda } from './vendas'

const ADMIN = { nome: 'Ayran Bade', papel: 'Administrador' }
const GERENTE = { nome: 'Gabriela Krüger', papel: 'Gerente comercial' }
const CORRETOR = { nome: 'João Victor Billó', papel: 'Corretor' }
const JUSTIFICATIVA = 'Financiamento negado; distrato assinado.'

const erroDe = async (promessa: Promise<unknown>) => {
  try {
    await promessa
  } catch (e) {
    return (e as Error).message
  }
  throw new Error('Era esperado um erro.')
}

const vendaCom = (status: 'em_escritura' | 'concluida' | 'cancelada') => lerDb().vendas.find((v) => v.status === status)!
const acharVenda = (id: string) => lerDb().vendas.find((v) => v.id === id)!

describe('cancelar venda', () => {
  it('exige justificativa e não altera nada sem ela', async () => {
    const venda = vendaCom('concluida')
    expect(await erroDe(cancelarVenda(venda.id, { justificativa: '' }, ADMIN))).toBe('Informe a justificativa do cancelamento.')
    expect(await erroDe(cancelarVenda(venda.id, { justificativa: 'curta' }, ADMIN))).toBe(
      'A justificativa precisa ter pelo menos 10 caracteres.',
    )
    expect(acharVenda(venda.id)).toEqual(venda)
  })

  it('grava o evento de auditoria no fim, sem mexer nos anteriores, e bloqueia o imóvel', async () => {
    const venda = vendaCom('concluida')
    const anteriores = venda.historico
    await cancelarVenda(venda.id, { justificativa: `  ${JUSTIFICATIVA}  ` }, ADMIN)

    const cancelada = acharVenda(venda.id)
    expect(cancelada.status).toBe('cancelada')
    expect(cancelada.cancelamento).toMatchObject({ justificativa: JUSTIFICATIVA, autor: 'Ayran Bade' })
    expect(cancelada.historico.slice(0, anteriores.length)).toEqual(anteriores)
    const evento = cancelada.historico.at(-1)!
    expect(evento).toMatchObject({ tipo: 'cancelamento', autor: 'Ayran Bade', statusAnterior: 'concluida', status: 'cancelada' })
    expect(evento.detalhe).toContain(JUSTIFICATIVA)
    expect(Date.now() - new Date(evento.data).getTime()).toBeLessThan(5_000)

    const imovel = lerDb().imoveis.find((i) => i.id === venda.imovelId)!
    expect(imovel.situacao).toBe('bloqueado')
    expect(imovel.bloqueio?.motivo).toBe('Venda cancelada')
    expect(lerDb().historico.at(-1)).toMatchObject({ imovelId: venda.imovelId, tipo: 'Cancelamento', referencia: venda.codigo })
  })

  it('aceita cancelar a partir de Em escritura', async () => {
    const venda = vendaCom('em_escritura')
    await cancelarVenda(venda.id, { justificativa: JUSTIFICATIVA }, ADMIN)
    expect(acharVenda(venda.id).historico.at(-1)?.statusAnterior).toBe('em_escritura')
  })

  it('não cancela duas vezes nem reabre uma venda cancelada', async () => {
    const venda = vendaCom('concluida')
    await cancelarVenda(venda.id, { justificativa: JUSTIFICATIVA }, ADMIN)
    const depois = acharVenda(venda.id)
    expect(await erroDe(cancelarVenda(venda.id, { justificativa: JUSTIFICATIVA }, ADMIN))).toBe('Esta venda já está cancelada.')
    expect(await erroDe(concluirEscritura(venda.id, ADMIN))).toBe('Só vendas Em escritura podem ser concluídas.')
    expect(acharVenda(venda.id)).toEqual(depois)
  })

  it('recusa perfis sem permissão', async () => {
    const venda = vendaCom('concluida')
    expect(await erroDe(cancelarVenda(venda.id, { justificativa: JUSTIFICATIVA }, GERENTE))).toBe(
      'Seu perfil não tem permissão para alterar vendas.',
    )
    expect(acharVenda(venda.id).status).toBe('concluida')
  })
})

describe('concluir escritura', () => {
  it('passa de Em escritura para Concluída com auditoria', async () => {
    const venda = vendaCom('em_escritura')
    await concluirEscritura(venda.id, ADMIN)
    const concluida = acharVenda(venda.id)
    expect(concluida.status).toBe('concluida')
    expect(concluida.historico.at(-1)).toMatchObject({ tipo: 'conclusao', statusAnterior: 'em_escritura', status: 'concluida', autor: 'Ayran Bade' })
  })

  it('o Gerente comercial conclui; o Corretor não', async () => {
    const venda = vendaCom('em_escritura')
    expect(await erroDe(concluirEscritura(venda.id, CORRETOR))).toBe('Seu perfil não tem permissão para alterar vendas.')
    await concluirEscritura(venda.id, GERENTE)
    expect(acharVenda(venda.id).status).toBe('concluida')
  })
})

describe('registrar venda', () => {
  const hoje = () => dataCalendario(new Date())
  /** Disponível, com matrícula e sem proposta nem reserva. */
  const loteLivre = () => {
    const db = lerDb()
    const ocupados = new Set([...db.propostas.map((p) => p.imovelId), ...db.reservas.map((r) => r.imovelId)])
    return db.imoveis.find((i) => i.situacao === 'disponivel' && i.status === 'publicado' && i.matricula && !ocupados.has(i.id))!
  }
  const dados = (parcial: Partial<DadosVenda> = {}): DadosVenda => ({
    imovelId: loteLivre().id,
    clienteId: 'cli-1',
    corretorId: 'usr-4',
    valor: 150_000,
    data: hoje(),
    status: 'em_escritura',
    ...parcial,
  })

  it('cria a venda com auditoria e marca o imóvel como Vendido', async () => {
    const entrada = dados()
    const venda = await registrarVenda(entrada, ADMIN)
    expect(venda).toMatchObject({ imovelId: entrada.imovelId, clienteId: 'cli-1', corretorId: 'usr-4', valor: 150_000, status: 'em_escritura' })
    expect(venda.codigo).toMatch(/^VD-\d{4}-\d{4}$/)
    expect(venda.historico).toEqual([expect.objectContaining({ tipo: 'registro', autor: 'Ayran Bade', statusAnterior: null, status: 'em_escritura' })])
    expect(lerDb().imoveis.find((i) => i.id === entrada.imovelId)?.situacao).toBe('vendido')
    expect(lerDb().vendas).toHaveLength(18)
  })

  it('converte a reserva ativa do comprador e vincula a venda a ela', async () => {
    const db = lerDb()
    const comProposta = new Set(db.propostas.map((p) => p.imovelId))
    const reserva = db.reservas.find((r) => r.status === 'ativa' && !comProposta.has(r.imovelId) && db.clientes.find((c) => c.id === r.clienteId)?.ativo)!
    const venda = await registrarVenda(dados({ imovelId: reserva.imovelId, clienteId: reserva.clienteId }), ADMIN)
    expect(venda.reservaId).toBe(reserva.id)
    const convertida = lerDb().reservas.find((r) => r.id === reserva.id)!
    expect(convertida.status).toBe('convertida')
    expect(convertida.historico.at(-1)?.tipo).toBe('conversao')
  })

  it('recusa imóvel já vendido, valor zerado e data futura', async () => {
    const vendido = vendaCom('concluida').imovelId
    expect(await erroDe(registrarVenda(dados({ imovelId: vendido }), ADMIN))).toBe('Este imóvel já tem uma venda registrada.')
    expect(await erroDe(registrarVenda(dados({ valor: 0 }), ADMIN))).toBe('Informe um valor maior que zero.')
    const amanha = new Date()
    amanha.setDate(amanha.getDate() + 1)
    expect(await erroDe(registrarVenda(dados({ data: dataCalendario(amanha) }), ADMIN))).toMatch(/não pode estar no futuro/)
    expect(lerDb().vendas).toHaveLength(17)
  })
})
