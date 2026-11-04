import type { CondicoesProposta, Proposta } from '../data/types'
import {
  acimaDaAlcada,
  adicionarDiasUteis,
  calcularCondicoes,
  compararCondicoes,
  CONFIG_PROPOSTAS,
  descreverMudancas,
  exigeDiretoria,
  formatarParcelas,
  formatarPercentual,
  formatarReaisTruncados,
  formVazio,
  instanteExpiracaoProposta,
  montarEtapas,
  podeDecidir,
  posicaoNoFluxo,
  situacaoProposta,
  validarProposta,
  type FormProposta,
} from './propostas'

/** Intl usa espaço não separável depois de "R$". */
const texto = (s: string) => s.replace(/\s/g, ' ')

const condicoes = (parcial: Partial<CondicoesProposta> = {}): CondicoesProposta => ({
  valorTabela: 455_000,
  descontoPercentual: 3,
  entrada: 88_270,
  parcelas: 24,
  indiceCorrecao: 'IGP-M',
  primeiroVencimento: '2026-10-10',
  formaPagamento: 'Entrada + financiamento direto',
  validadeDias: 7,
  escritura: 'Após quitação',
  garantia: 'Alienação fiduciária',
  ...parcial,
})

describe('cálculos da proposta', () => {
  it('reproduz os valores do protótipo (Lote 12)', () => {
    const k = calcularCondicoes(condicoes())
    expect(k.descontoValor).toBe(13_650)
    expect(k.valorProposto).toBe(441_350)
    expect(k.saldo).toBe(353_080)
    expect(k.valorParcela).toBe(14_711.67)
    expect(k.entradaPercentual).toBeCloseTo(20)
  })

  it('calcula a parcela com centavos e a última absorve o arredondamento', () => {
    const k = calcularCondicoes(condicoes())
    expect(k.ultimaParcela).toBe(14_711.59)
    expect(k.valorParcela * 23 + k.ultimaParcela).toBeCloseTo(k.saldo, 2)
  })

  it('exibe a parcela truncada, sem centavos, como no protótipo', () => {
    expect(texto(formatarReaisTruncados(14_711.67))).toBe('R$ 14.711')
    expect(texto(formatarReaisTruncados(14_711.99))).toBe('R$ 14.711')
    expect(texto(formatarParcelas(24, 14_711.67))).toBe('24x de R$ 14.711')
  })

  it('não acumula erro de ponto flutuante com descontos fracionados (Lote 31)', () => {
    const desconto = ((455_000 - 420_000) / 455_000) * 100
    const k = calcularCondicoes(condicoes({ descontoPercentual: desconto, entrada: 126_000 }))
    expect(k.valorProposto).toBe(420_000)
    expect(k.valorParcela).toBe(12_250)
    expect(formatarPercentual(desconto)).toBe('7,7%')
    expect(formatarPercentual(3)).toBe('3%')
  })

  it('parcela única sem saldo aparece como à vista', () => {
    const k = calcularCondicoes(condicoes({ descontoPercentual: 0, entrada: 455_000, parcelas: 1 }))
    expect(k.valorParcela).toBe(0)
    expect(formatarParcelas(1, k.valorParcela)).toBe('À vista')
  })
})

describe('alçada', () => {
  it('desconto acima da alçada do vendedor exige aprovação do gestor', () => {
    expect(CONFIG_PROPOSTAS.alcadaVendedorPercentual).toBe(2)
    expect(acimaDaAlcada(0)).toBe(false)
    expect(acimaDaAlcada(2)).toBe(false)
    expect(acimaDaAlcada(2.01)).toBe(true)
    expect(acimaDaAlcada(3)).toBe(true)
  })

  it('acima da alçada do gestor também passa pela diretoria', () => {
    expect(exigeDiretoria(5)).toBe(false)
    expect(exigeDiretoria(7.7)).toBe(true)
  })
})

describe('validade em dias úteis', () => {
  it('pula sábados e domingos', () => {
    // 21/08/2026 é sexta-feira.
    expect(adicionarDiasUteis('2026-08-21', 1)).toBe('2026-08-24')
    expect(adicionarDiasUteis('2026-08-21', 7)).toBe('2026-09-01')
  })

  it('a proposta vale até o fim do último dia útil', () => {
    const fim = new Date(instanteExpiracaoProposta('2026-08-21', 7))
    expect([fim.getFullYear(), fim.getMonth() + 1, fim.getDate(), fim.getHours(), fim.getMinutes()]).toEqual([2026, 9, 1, 23, 59])
  })
})

describe('situação efetiva (RF21)', () => {
  const agora = new Date(2026, 8, 2, 12).getTime()
  const passou = new Date(2026, 8, 1, 23, 59).toISOString()
  const futuro = new Date(2026, 8, 3).toISOString()

  it('proposta em andamento vira Expirada depois da validade', () => {
    for (const situacao of ['enviada', 'em_analise', 'aguardando_diretoria', 'contraproposta'] as const) {
      expect(situacaoProposta({ situacao, expiraEm: passou }, agora)).toBe('expirada')
      expect(situacaoProposta({ situacao, expiraEm: futuro }, agora)).toBe(situacao)
    }
  })

  it('decididas e rascunhos não expiram', () => {
    expect(situacaoProposta({ situacao: 'aprovada', expiraEm: passou }, agora)).toBe('aprovada')
    expect(situacaoProposta({ situacao: 'recusada', expiraEm: passou }, agora)).toBe('recusada')
    expect(situacaoProposta({ situacao: 'rascunho' }, agora)).toBe('rascunho')
  })
})

describe('validação do formulário', () => {
  const hoje = '2026-10-12'
  const valido = (parcial: Partial<FormProposta> = {}): FormProposta => ({
    ...formVazio({ hoje }),
    descontoPercentual: '3',
    entrada: 88_270,
    parcelas: '24',
    aprovadorId: 'usr-2',
    ...parcial,
  })
  const ctx = { valorTabela: 455_000, minimo: 418_500, hoje, envio: true }

  it('aceita uma proposta completa', () => {
    expect(validarProposta(valido(), ctx)).toEqual({})
  })

  it('aplica as regras de valores, parcelas e datas', () => {
    expect(validarProposta(valido({ descontoPercentual: '-1' }), ctx).descontoPercentual).toBeDefined()
    expect(validarProposta(valido({ descontoPercentual: 'abc' }), ctx).descontoPercentual).toBeDefined()
    expect(validarProposta(valido({ parcelas: '0' }), ctx).parcelas).toBeDefined()
    expect(validarProposta(valido({ parcelas: '2.5' }), ctx).parcelas).toBeDefined()
    expect(validarProposta(valido({ entrada: 441_351 }), ctx).entrada).toBe('A entrada não pode ser maior que o valor proposto.')
    expect(validarProposta(valido({ entrada: 441_350 }), ctx).entrada).toBeUndefined()
    expect(validarProposta(valido({ primeiroVencimento: hoje }), ctx).primeiroVencimento).toBe('O primeiro vencimento precisa ser uma data futura.')
    expect(validarProposta(valido({ formaPagamento: ' ' }), ctx).formaPagamento).toBeDefined()
  })

  it('aceita desconto com vírgula decimal', () => {
    expect(validarProposta(valido({ descontoPercentual: '1,5' }), ctx)).toEqual({})
  })

  it('exige aprovador só quando o desconto passa da alçada', () => {
    expect(validarProposta(valido({ aprovadorId: '' }), ctx).aprovadorId).toBe('Desconto acima da alçada: selecione o aprovador.')
    expect(validarProposta(valido({ aprovadorId: '', descontoPercentual: '2' }), ctx).aprovadorId).toBeUndefined()
  })

  it('bloqueia valor proposto abaixo do mínimo aceito, mas aceita exatamente o mínimo', () => {
    const abaixo = validarProposta(valido({ descontoPercentual: '9' }), ctx)
    expect(texto(abaixo.valorProposto ?? '')).toBe('Abaixo do mínimo aceito para este imóvel (R$ 418.500).')
    // 8% de 455.000 → valor proposto de 418.600.
    expect(validarProposta(valido({ descontoPercentual: '8' }), { ...ctx, minimo: 418_600 }).valorProposto).toBeUndefined()
    expect(validarProposta(valido({ descontoPercentual: '8' }), { ...ctx, minimo: 418_601 }).valorProposto).toBeDefined()
    expect(validarProposta(valido({ descontoPercentual: '9' }), { ...ctx, minimo: null }).valorProposto).toBeUndefined()
  })

  it('o rascunho só verifica o formato dos campos', () => {
    const rascunho = { ...ctx, envio: false }
    expect(validarProposta(valido({ aprovadorId: '', descontoPercentual: '9', primeiroVencimento: '' }), rascunho)).toEqual({})
    expect(validarProposta(valido({ parcelas: 'x' }), rascunho).parcelas).toBeDefined()
  })
})

describe('comparação de versões', () => {
  it('gera "O que mudou" a partir da versão anterior', () => {
    expect(descreverMudancas(undefined, condicoes())).toBe('Versão inicial')
    expect(descreverMudancas(condicoes({ parcelas: 18 }), condicoes())).toBe('Parcelamento alterado de 18x para 24x')
    expect(texto(descreverMudancas(condicoes({ descontoPercentual: 0, entrada: 136_500 }), condicoes()))).toBe(
      'Desconto alterado de 0% para 3%; Entrada alterada de R$ 136.500 para R$ 88.270',
    )
    expect(descreverMudancas(condicoes(), condicoes())).toBe('Sem alterações nas condições')
  })

  it('o comparativo destaca também os campos calculados', () => {
    const linhas = compararCondicoes(condicoes({ parcelas: 18 }), condicoes())
    const mudaram = linhas.filter((l) => l.mudou).map((l) => l.chave)
    expect(mudaram).toEqual(['parcelas', 'valorParcela'])
  })
})

describe('decisão por papel e etapa', () => {
  const proposta = (parcial: Partial<Proposta> = {}): Proposta => ({
    id: 'p',
    codigo: 'PROP-2026-0001',
    reservaId: 'r',
    imovelId: 'i',
    clienteId: 'c',
    corretorId: 'k',
    situacao: 'enviada',
    criadaEm: '2026-10-01T10:00:00.000Z',
    atualizadaEm: '2026-10-01T10:00:00.000Z',
    expiraEm: new Date(2099, 0, 1).toISOString(),
    versoes: [],
    etapas: montarEtapas({
      autor: 'Corretor',
      enviadaEm: '2026-10-01T10:00:00.000Z',
      aprovador: { id: 'usr-2', nome: 'Gestor', cargo: 'Gestor comercial' },
      diretoria: { id: 'usr-1', nome: 'Diretor', cargo: 'Administrador' },
    }),
    historico: [],
    ...parcial,
  })
  const agora = new Date(2026, 9, 12).getTime()

  it('só o responsável pela etapa que aguarda pode decidir', () => {
    const p = proposta()
    expect(posicaoNoFluxo(p)).toEqual({ atual: 2, total: 4 })
    expect(podeDecidir(p, 'usr-2', agora)).toBe(true)
    expect(podeDecidir(p, 'usr-1', agora)).toBe(false)
    expect(podeDecidir(p, undefined, agora)).toBe(false)
  })

  it('na etapa da diretoria, a decisão passa para a diretoria', () => {
    const p = proposta({ situacao: 'aguardando_diretoria' })
    p.etapas = p.etapas.map((e) =>
      e.tipo === 'analise_comercial' ? { ...e, estado: 'concluida' } : e.tipo === 'diretoria' ? { ...e, estado: 'aguardando' } : e,
    )
    expect(posicaoNoFluxo(p)).toEqual({ atual: 3, total: 4 })
    expect(podeDecidir(p, 'usr-1', agora)).toBe(true)
    expect(podeDecidir(p, 'usr-2', agora)).toBe(false)
  })

  it('ninguém decide propostas expiradas, em contraproposta ou já decididas', () => {
    expect(podeDecidir(proposta({ expiraEm: new Date(2026, 0, 1).toISOString() }), 'usr-2', agora)).toBe(false)
    expect(podeDecidir(proposta({ situacao: 'contraproposta' }), 'usr-2', agora)).toBe(false)
    expect(podeDecidir(proposta({ situacao: 'recusada' }), 'usr-2', agora)).toBe(false)
  })
})
