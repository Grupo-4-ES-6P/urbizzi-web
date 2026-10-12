import { lerDb } from '../data/db'
import type { Venda } from '../data/types'
import { formatarMoedaAbreviada } from './format'
import {
  compararPorData,
  impedimentoVenda,
  podeCancelar,
  podeGerirVendas,
  resumoVendas,
  validarJustificativa,
  validarVenda,
  vendaVazia,
  type FormVenda,
} from './vendas'

const OUTUBRO_2026 = new Date(2026, 9, 12, 10).getTime()

const venda = (parcial: Partial<Venda>): Venda => ({
  id: 'v',
  codigo: 'VD-2026-0001',
  imovelId: 'imo',
  clienteId: 'cli',
  corretorId: 'cor',
  valor: 100_000,
  data: new Date(2026, 5, 1, 12).toISOString(),
  status: 'concluida',
  historico: [],
  ...parcial,
})

describe('resumo de vendas', () => {
  it('reproduz o cabeçalho do protótipo com os dados de demonstração', () => {
    const resumo = resumoVendas(lerDb().vendas, OUTUBRO_2026)
    expect(resumo).toEqual({ registradas: 17, canceladas: 2, valorNoAno: 4_209_000 })
    expect(formatarMoedaAbreviada(resumo.valorNoAno)).toBe('R$\u00a04,2M')
  })

  it('conta canceladas entre as registradas, mas tira do valor do ano; outros anos não entram', () => {
    const resumo = resumoVendas(
      [
        venda({ valor: 300_000 }),
        venda({ valor: 50_000, status: 'em_escritura' }),
        venda({ valor: 999_000, status: 'cancelada' }),
        venda({ valor: 777_000, data: new Date(2025, 11, 31, 12).toISOString() }),
      ],
      OUTUBRO_2026,
    )
    expect(resumo).toEqual({ registradas: 4, canceladas: 1, valorNoAno: 350_000 })
  })

  it('ordena da venda mais recente para a mais antiga', () => {
    const ordenadas = [...lerDb().vendas].sort(compararPorData).map((v) => v.data.slice(0, 10))
    expect(ordenadas).toEqual([...ordenadas].sort().reverse())
    expect(new Date([...lerDb().vendas].sort(compararPorData)[0].data).toLocaleDateString('pt-BR')).toBe('12/08/2026')
  })
})

describe('abreviação de valores', () => {
  it('usa M para milhões e "mil" para milhares, como no protótipo', () => {
    expect(formatarMoedaAbreviada(4_209_000)).toBe('R$\u00a04,2M')
    expect(formatarMoedaAbreviada(12_000_000)).toBe('R$\u00a012M')
    expect(formatarMoedaAbreviada(850_000)).toBe('R$\u00a0850\u00a0mil')
    expect(formatarMoedaAbreviada(0)).toBe('R$\u00a00')
  })
})

describe('permissões e regras de status', () => {
  it('só Administrador e Gestor comercial gerem vendas', () => {
    expect(podeGerirVendas({ papel: 'Administrador' })).toBe(true)
    expect(podeGerirVendas({ papel: 'Gestor comercial' })).toBe(true)
    expect(podeGerirVendas({ papel: 'Gerente comercial' })).toBe(false)
    expect(podeGerirVendas(null)).toBe(false)
  })

  it('cancela a partir de Em escritura e de Concluída, nunca de novo', () => {
    expect(podeCancelar({ status: 'em_escritura' })).toBe(true)
    expect(podeCancelar({ status: 'concluida' })).toBe(true)
    expect(podeCancelar({ status: 'cancelada' })).toBe(false)
  })

  it('exige justificativa com pelo menos 10 caracteres', () => {
    expect(validarJustificativa('   ')).toBe('Informe a justificativa do cancelamento.')
    expect(validarJustificativa('curta')).toBe('A justificativa precisa ter pelo menos 10 caracteres.')
    expect(validarJustificativa('  Distrato assinado  ')).toBeUndefined()
  })
})

describe('validação do registro', () => {
  const hoje = '2026-10-12'
  const valido: FormVenda = { loteamento: 'Jd. Europa', imovelId: 'imo', clienteId: 'cli', corretorId: 'cor', valor: 150_000, data: hoje, status: 'em_escritura' }

  it('aponta todos os obrigatórios do formulário vazio, com Em escritura por padrão', () => {
    const vazio = vendaVazia(hoje)
    expect(vazio.status).toBe('em_escritura')
    expect(Object.keys(validarVenda(vazio, hoje)).sort()).toEqual(['clienteId', 'corretorId', 'imovelId', 'loteamento', 'valor'])
  })

  it('exige valor maior que zero e data que não esteja no futuro', () => {
    expect(validarVenda(valido, hoje)).toEqual({})
    expect(validarVenda({ ...valido, valor: 0 }, hoje).valor).toBe('Informe um valor maior que zero.')
    expect(validarVenda({ ...valido, data: '2026-10-13' }, hoje).data).toBe('A data da venda não pode estar no futuro.')
    expect(validarVenda({ ...valido, data: '2026-02-30' }, hoje).data).toBe('Informe uma data válida.')
    expect(validarVenda(valido, hoje, 'Este imóvel já tem uma venda registrada.').imovelId).toBe('Este imóvel já tem uma venda registrada.')
  })

  it('impede imóvel vendido, bloqueado ou com proposta em andamento', () => {
    const db = lerDb()
    const agora = Date.now()
    const vendido = db.vendas.find((v) => v.status === 'concluida')!
    const cancelada = db.vendas.find((v) => v.status === 'cancelada')!
    const comProposta = db.propostas.find((p) => p.situacao === 'em_analise')!
    expect(impedimentoVenda(db, vendido.imovelId, '', agora)).toBe('Este imóvel já tem uma venda registrada.')
    expect(impedimentoVenda(db, cancelada.imovelId, '', agora)).toBe('Imóvel bloqueado não pode ser vendido. Reabilite-o antes.')
    expect(impedimentoVenda(db, comProposta.imovelId, comProposta.clienteId, agora)).toMatch(/proposta em andamento/)
  })

  it('imóvel reservado só pode ser vendido ao cliente da reserva', () => {
    const db = lerDb()
    const agora = Date.now()
    const comProposta = new Set(db.propostas.map((p) => p.imovelId))
    const reserva = db.reservas.find(
      (r) => r.status === 'ativa' && new Date(r.expiraEm).getTime() > agora && !comProposta.has(r.imovelId),
    )!
    const outro = db.clientes.find((c) => c.id !== reserva.clienteId)!
    expect(impedimentoVenda(db, reserva.imovelId, outro.id, agora)).toBe('Este imóvel está reservado para outro cliente.')
    expect(impedimentoVenda(db, reserva.imovelId, reserva.clienteId, agora)).toBeUndefined()
  })
})
