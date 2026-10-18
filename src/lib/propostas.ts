import type {
  CondicoesProposta,
  EtapaAprovacao,
  Proposta,
  SituacaoProposta,
  SituacaoVersao,
  TipoEventoProposta,
  VarianteBadge,
  VersaoProposta,
} from '../data/types'
import { formatarMoedaInteira } from './format'
import { adicionarDias, dataCalendarioValida, formatarData } from './reservas'

// ===== Configuração =====

/**
 * Regras comerciais que ainda não existem no cadastro (nem no backend).
 * Ficam todas aqui, num único lugar, até ganharem tela de configuração/API.
 */
export const CONFIG_PROPOSTAS = {
  /** Desconto máximo (%) que o vendedor concede sem aprovação do gestor. */
  alcadaVendedorPercentual: 2,
  /** Acima deste desconto (%) a proposta também passa pela aprovação da diretoria. */
  alcadaGestorPercentual: 5,
  /** Validade padrão em dias úteis (sábado e domingo não contam; feriados ainda não são considerados). */
  validadePadraoDiasUteis: 7,
  validadeMaximaDiasUteis: 60,
  /** O aviso de prazo aparece nesta quantidade de dias corridos antes da expiração. */
  avisoPrazoDias: 3,
  parcelasMaximas: 240,
  /** Usuário que responde pela etapa "Aprovação da diretoria". */
  diretoriaUsuarioId: 'usr-1',
  /** Quem faz a análise comercial quando o desconto está dentro da alçada e nenhum aprovador foi escolhido. */
  gestorPadraoUsuarioId: 'usr-2',
} as const

export const INDICES_CORRECAO = ['IGP-M', 'INCC', 'IPCA', 'Sem correção']
export const FORMAS_PAGAMENTO = ['À vista', 'Entrada + parcelamento', 'Entrada + financiamento direto', 'Financiamento bancário']
export const OPCOES_ESCRITURA = ['Na assinatura', 'Após 12ª parcela', 'Após quitação']
export const OPCOES_GARANTIA = ['Alienação fiduciária', 'Hipoteca', 'Nota promissória', 'Sem garantia']

// ===== Cálculos =====

/** Arredonda para centavos (meio para cima), corrigindo o erro de ponto flutuante. */
export function arredondarCentavos(valor: number) {
  return Math.round((valor + Number.EPSILON) * 100) / 100
}

export interface CalculoProposta {
  descontoValor: number
  valorProposto: number
  /** Valor proposto menos a entrada. */
  saldo: number
  /** Parcela com centavos, arredondada para o centavo mais próximo. */
  valorParcela: number
  /** Última parcela: absorve a diferença do arredondamento para o total fechar com o saldo. */
  ultimaParcela: number
  entradaPercentual: number
}

/**
 * - desconto em R$ = valor de tabela × desconto %
 * - valor proposto = valor de tabela − desconto
 * - parcela = (valor proposto − entrada) / nº de parcelas
 * Tudo calculado com centavos; a exibição sem centavos fica em `formatarReaisTruncados`.
 */
export function calcularCondicoes(
  c: Pick<CondicoesProposta, 'valorTabela' | 'descontoPercentual' | 'entrada' | 'parcelas'>,
): CalculoProposta {
  const descontoValor = arredondarCentavos((c.valorTabela * c.descontoPercentual) / 100)
  const valorProposto = arredondarCentavos(c.valorTabela - descontoValor)
  const saldo = arredondarCentavos(valorProposto - c.entrada)
  const parcelas = Math.max(1, Math.floor(c.parcelas))
  const valorParcela = arredondarCentavos(saldo / parcelas)
  return {
    descontoValor,
    valorProposto,
    saldo,
    valorParcela,
    ultimaParcela: arredondarCentavos(saldo - valorParcela * (parcelas - 1)),
    entradaPercentual: valorProposto > 0 ? (c.entrada / valorProposto) * 100 : 0,
  }
}

/** Exibe só os reais, descartando os centavos (R$ 14.711,67 → "R$ 14.711"), como no protótipo. */
export function formatarReaisTruncados(valor: number) {
  return formatarMoedaInteira(Math.trunc(valor))
}

const percentual = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

/** 3 → "3%", 7.6923 → "7,7%". */
export function formatarPercentual(valor: number) {
  return `${percentual.format(valor)}%`
}

/** "24x de R$ 14.711" */
export function formatarParcelas(parcelas: number, valorParcela: number) {
  return parcelas <= 1 && valorParcela <= 0 ? 'À vista' : `${parcelas}x de ${formatarReaisTruncados(valorParcela)}`
}

export const formatarValidade = (dias: number) => `${dias} ${dias === 1 ? 'dia útil' : 'dias úteis'}`

/** Desconto acima da alçada do vendedor exige aprovação do gestor. */
export function acimaDaAlcada(descontoPercentual: number, alcada: number = CONFIG_PROPOSTAS.alcadaVendedorPercentual) {
  return descontoPercentual > alcada
}

/** Desconto acima da alçada do gestor também passa pela diretoria. */
export function exigeDiretoria(descontoPercentual: number, alcada: number = CONFIG_PROPOSTAS.alcadaGestorPercentual) {
  return descontoPercentual > alcada
}

// ===== Prazos (dias úteis) =====

function partes(data: string) {
  const [ano, mes, dia] = data.split('-').map(Number)
  return { ano, mes, dia }
}

const ehDiaUtil = (data: string) => {
  const { ano, mes, dia } = partes(data)
  const semana = new Date(ano, mes - 1, dia).getDay()
  return semana !== 0 && semana !== 6
}

/** Soma dias úteis (segunda a sexta) a uma data YYYY-MM-DD. */
export function adicionarDiasUteis(data: string, dias: number) {
  let atual = data
  let restantes = dias
  while (restantes > 0) {
    atual = adicionarDias(atual, 1)
    if (ehDiaUtil(atual)) restantes--
  }
  return atual
}

/** A proposta vale até o fim do N-ésimo dia útil após o envio. */
export function instanteExpiracaoProposta(dataEnvio: string, validadeDiasUteis: number) {
  const { ano, mes, dia } = partes(adicionarDiasUteis(dataEnvio, validadeDiasUteis))
  return new Date(ano, mes - 1, dia, 23, 59, 59, 999).toISOString()
}

// ===== Situação =====

const EM_ANDAMENTO: SituacaoProposta[] = ['enviada', 'em_analise', 'aguardando_diretoria', 'contraproposta']
const AGUARDANDO_DECISAO: SituacaoProposta[] = ['enviada', 'em_analise', 'aguardando_diretoria']

export const emAndamento = (s: SituacaoProposta) => EM_ANDAMENTO.includes(s)

/**
 * Situação efetiva da proposta. É o único lugar que decide a expiração (RF21):
 * passada a validade sem decisão, a proposta é tratada como Expirada.
 */
export function situacaoProposta(p: Pick<Proposta, 'situacao' | 'expiraEm'>, agora: number): SituacaoProposta {
  if (emAndamento(p.situacao) && p.expiraEm && new Date(p.expiraEm).getTime() <= agora) return 'expirada'
  return p.situacao
}

/** Proposta em rascunho ou em andamento da reserva: cada reserva tem no máximo uma aberta (RF17). */
export function propostaAberta(propostas: Proposta[], reservaId: string, agora: number, ignorarId?: string) {
  return propostas.find(
    (p) => p.reservaId === reservaId && p.id !== ignorarId && (p.situacao === 'rascunho' || emAndamento(situacaoProposta(p, agora))),
  )
}

export const versaoAtual = (p: Pick<Proposta, 'versoes'>) => p.versoes[p.versoes.length - 1]

export const valorProposta = (p: Pick<Proposta, 'versoes'>) => calcularCondicoes(versaoAtual(p).condicoes).valorProposto

/** Situação mostrada para uma versão: a vigente acompanha a expiração da proposta. */
export function situacaoVersao(p: Proposta, v: VersaoProposta, agora: number): SituacaoVersao {
  const atual = v.numero === versaoAtual(p).numero
  return atual && situacaoProposta(p, agora) === 'expirada' ? 'expirada' : v.situacao
}

export const etapaAtual = (p: Pick<Proposta, 'etapas'>) => p.etapas.find((e) => e.estado === 'aguardando')

/** Os botões de decisão só aparecem para o responsável pela etapa que está aguardando. */
export function podeDecidir(p: Proposta, usuarioId: string | undefined, agora: number) {
  if (!usuarioId || !AGUARDANDO_DECISAO.includes(situacaoProposta(p, agora))) return false
  return etapaAtual(p)?.responsavelId === usuarioId
}

/** Corretor pode registrar nova versão enquanto a proposta segue em negociação. */
export function permiteNovaVersao(p: Proposta, agora: number) {
  return emAndamento(situacaoProposta(p, agora))
}

/** Posição exibida em "Etapa X de N". */
export function posicaoNoFluxo(p: Pick<Proposta, 'etapas'>) {
  const total = p.etapas.length
  const indice = p.etapas.findIndex((e) => e.estado === 'aguardando' || e.estado === 'recusada')
  if (indice >= 0) return { atual: indice + 1, total }
  const concluidas = p.etapas.filter((e) => e.estado === 'concluida').length
  return { atual: Math.min(concluidas + 1, total), total }
}

type Rotulo = { rotulo: string; variante: VarianteBadge }

export const SITUACAO_PROPOSTA: Record<SituacaoProposta, Rotulo> = {
  rascunho: { rotulo: 'Rascunho', variante: 'rascunho' },
  enviada: { rotulo: 'Enviada', variante: 'escuro' },
  em_analise: { rotulo: 'Em análise', variante: 'escuro' },
  aguardando_diretoria: { rotulo: 'Aguardando diretoria', variante: 'atencao' },
  aprovada: { rotulo: 'Aprovada', variante: 'normal' },
  recusada: { rotulo: 'Recusada', variante: 'critico' },
  contraproposta: { rotulo: 'Contraproposta', variante: 'laranja' },
  expirada: { rotulo: 'Expirada', variante: 'neutro' },
}

export const SITUACAO_VERSAO: Record<SituacaoVersao, Rotulo> = {
  rascunho: { rotulo: 'Rascunho', variante: 'rascunho' },
  em_analise: { rotulo: 'Em análise', variante: 'escuro' },
  aprovada: { rotulo: 'Aprovada', variante: 'normal' },
  recusada: { rotulo: 'Recusada', variante: 'critico' },
  contraproposta: { rotulo: 'Contraproposta', variante: 'laranja' },
  substituida: { rotulo: 'Substituída', variante: 'neutro' },
  expirada: { rotulo: 'Expirada', variante: 'neutro' },
}

/** Selo de cada evento na tabela "Decisões e prazos". */
export const SITUACAO_EVENTO: Record<TipoEventoProposta, Rotulo> = {
  criacao: { rotulo: 'Rascunho', variante: 'rascunho' },
  rascunho: { rotulo: 'Rascunho', variante: 'rascunho' },
  envio: { rotulo: 'Enviada', variante: 'escuro' },
  nova_versao: { rotulo: 'Enviada', variante: 'escuro' },
  analise: { rotulo: 'Em análise', variante: 'escuro' },
  aprovacao_etapa: { rotulo: 'Aprovada', variante: 'normal' },
  aprovacao: { rotulo: 'Aprovada', variante: 'normal' },
  recusa: { rotulo: 'Recusada', variante: 'critico' },
  contraproposta: { rotulo: 'Contraproposta', variante: 'laranja' },
}

/** Eventos que entram em "Decisões e prazos" (os salvamentos de rascunho ficam só no histórico). */
export const EVENTOS_DE_DECISAO: TipoEventoProposta[] = ['envio', 'nova_versao', 'analise', 'aprovacao_etapa', 'aprovacao', 'recusa', 'contraproposta']

export interface EventoPrazo {
  id: string
  data: string
  titulo: string
  autor: string
  detalhe: string
  situacao: Rotulo
}

const DIA = 86_400_000

/** Eventos gerados pelo sistema a partir da validade: aviso de prazo e prazo final (RF20/RF21). */
export function eventosDePrazo(p: Proposta, agora: number): EventoPrazo[] {
  const situacao = situacaoProposta(p, agora)
  if (!p.expiraEm || (!emAndamento(situacao) && situacao !== 'expirada')) return []
  const expira = new Date(p.expiraEm).getTime()
  const aviso = expira - CONFIG_PROPOSTAS.avisoPrazoDias * DIA
  const eventos: EventoPrazo[] = []
  if (situacao !== 'expirada') {
    const avisou = agora >= aviso
    const faltam = Math.max(1, Math.ceil((expira - agora) / DIA))
    eventos.push({
      id: `${p.id}-aviso`,
      data: new Date(avisou ? agora : aviso).toISOString(),
      titulo: 'Aviso de prazo',
      autor: 'Sistema',
      detalhe: avisou
        ? `Faltam ${faltam} ${faltam === 1 ? 'dia' : 'dias'} para a proposta expirar`
        : `Aviso automático ${CONFIG_PROPOSTAS.avisoPrazoDias} dias antes do prazo`,
      situacao: avisou ? { rotulo: 'Atenção', variante: 'atencao' } : { rotulo: 'Previsto', variante: 'escuro' },
    })
  }
  eventos.push({
    id: `${p.id}-prazo`,
    data: p.expiraEm,
    titulo: situacao === 'expirada' ? 'Proposta expirada' : 'Prazo final',
    autor: 'Sistema',
    detalhe:
      situacao === 'expirada'
        ? 'Sem decisão no prazo; a reserva segue com o próprio prazo (RF21)'
        : 'Sem decisão até esta data a proposta expira',
    situacao: situacao === 'expirada' ? SITUACAO_PROPOSTA.expirada : { rotulo: 'Previsto', variante: 'escuro' },
  })
  return eventos
}

// ===== Comparação de versões =====

type Campo = {
  chave: string
  rotulo: string
  /** Gênero do rótulo, para "alterado"/"alterada". */
  feminino?: boolean
  /** Campos calculados aparecem no comparativo, mas não no "O que mudou". */
  derivado?: boolean
  valor: (c: CondicoesProposta, calc: CalculoProposta) => string
}

const CAMPOS: Campo[] = [
  { chave: 'valorProposto', rotulo: 'Valor proposto', derivado: true, valor: (_, k) => formatarMoedaInteira(k.valorProposto) },
  { chave: 'descontoPercentual', rotulo: 'Desconto', valor: (c) => formatarPercentual(c.descontoPercentual) },
  { chave: 'entrada', rotulo: 'Entrada', feminino: true, valor: (c) => formatarMoedaInteira(c.entrada) },
  { chave: 'parcelas', rotulo: 'Parcelamento', valor: (c) => `${c.parcelas}x` },
  { chave: 'valorParcela', rotulo: 'Valor da parcela', derivado: true, valor: (_, k) => formatarReaisTruncados(k.valorParcela) },
  { chave: 'indiceCorrecao', rotulo: 'Índice de correção', valor: (c) => c.indiceCorrecao },
  { chave: 'primeiroVencimento', rotulo: 'Primeiro vencimento', valor: (c) => formatarData(c.primeiroVencimento) },
  { chave: 'formaPagamento', rotulo: 'Forma de pagamento', feminino: true, valor: (c) => c.formaPagamento },
  { chave: 'validadeDias', rotulo: 'Validade', feminino: true, valor: (c) => formatarValidade(c.validadeDias) },
  { chave: 'escritura', rotulo: 'Escritura', feminino: true, valor: (c) => c.escritura },
  { chave: 'garantia', rotulo: 'Garantia', feminino: true, valor: (c) => c.garantia },
]

export interface LinhaComparacao {
  chave: string
  rotulo: string
  antes: string
  depois: string
  mudou: boolean
}

export function compararCondicoes(antes: CondicoesProposta, depois: CondicoesProposta): LinhaComparacao[] {
  const ca = calcularCondicoes(antes)
  const cd = calcularCondicoes(depois)
  return CAMPOS.map((c) => {
    const a = c.valor(antes, ca)
    const d = c.valor(depois, cd)
    return { chave: c.chave, rotulo: c.rotulo, antes: a, depois: d, mudou: a !== d }
  })
}

/** Texto de "O que mudou", gerado a partir da versão anterior. Ex.: "Parcelamento alterado de 18x para 24x". */
export function descreverMudancas(anterior: CondicoesProposta | undefined, nova: CondicoesProposta) {
  if (!anterior) return 'Versão inicial'
  const linhas = compararCondicoes(anterior, nova)
  const mudancas = CAMPOS.filter((c) => !c.derivado)
    .map((c) => {
      const l = linhas.find((x) => x.chave === c.chave)!
      return l.mudou ? `${c.rotulo} ${c.feminino ? 'alterada' : 'alterado'} de ${l.antes} para ${l.depois}` : null
    })
    .filter((t): t is string => t !== null)
  return mudancas.length ? mudancas.join('; ') : 'Sem alterações nas condições'
}

// ===== Formulário =====

export interface FormProposta {
  descontoPercentual: string
  entrada: number | null
  parcelas: string
  indiceCorrecao: string
  primeiroVencimento: string
  formaPagamento: string
  validadeDias: string
  aprovadorId: string
  escritura: string
  garantia: string
  observacoes: string
  anexos: string[]
  comentario: string
}

export type CampoErroProposta = keyof FormProposta | 'valorProposto'
export type ErrosProposta = Partial<Record<CampoErroProposta, string>>

/** Lê números digitados em pt-BR ("3,5") ou com ponto. */
export function lerNumero(valor: string) {
  const texto = valor.trim().replace(',', '.')
  if (!/^-?\d+(\.\d+)?$/.test(texto)) return null
  return Number(texto)
}

const lerInteiro = (valor: string) => (/^\d+$/.test(valor.trim()) ? Number(valor) : null)

export function formVazio(base: { hoje: string; descontoPercentual?: number | null; formaPagamento?: string; aprovadorId?: string }): FormProposta {
  return {
    descontoPercentual: base.descontoPercentual ? String(base.descontoPercentual).replace('.', ',') : '0',
    entrada: null,
    parcelas: '1',
    indiceCorrecao: INDICES_CORRECAO[0],
    primeiroVencimento: adicionarDias(base.hoje, 30),
    formaPagamento: base.formaPagamento?.trim() || FORMAS_PAGAMENTO[1],
    validadeDias: String(CONFIG_PROPOSTAS.validadePadraoDiasUteis),
    aprovadorId: base.aprovadorId ?? '',
    escritura: OPCOES_ESCRITURA[2],
    garantia: OPCOES_GARANTIA[0],
    observacoes: '',
    anexos: [],
    comentario: '',
  }
}

/** Base do formulário de nova versão / contraproposta: cópia exata da versão vigente. */
export function formDaVersao(v: VersaoProposta): FormProposta {
  const c = v.condicoes
  return {
    descontoPercentual: String(arredondarCentavos(c.descontoPercentual)).replace('.', ','),
    entrada: c.entrada,
    parcelas: String(c.parcelas),
    indiceCorrecao: c.indiceCorrecao,
    primeiroVencimento: c.primeiroVencimento,
    formaPagamento: c.formaPagamento,
    validadeDias: String(c.validadeDias),
    aprovadorId: v.aprovadorId,
    escritura: c.escritura,
    garantia: c.garantia,
    observacoes: v.observacoes,
    anexos: [...v.anexos],
    comentario: '',
  }
}

/**
 * Converte o formulário em condições. Campos ilegíveis viram valores neutros,
 * para que o rascunho possa ser salvo incompleto.
 */
export function condicoesDoForm(f: FormProposta, valorTabela: number, versaoBase?: VersaoProposta): CondicoesProposta {
  const desconto = lerNumero(f.descontoPercentual)
  // Mantém a precisão original quando o desconto não foi editado (ex.: 7,6923% salvo como "7,69").
  const base = versaoBase?.condicoes.descontoPercentual
  const mesmoDesconto = base !== undefined && desconto !== null && desconto === arredondarCentavos(base)
  return {
    valorTabela,
    descontoPercentual: mesmoDesconto ? base : (desconto ?? 0),
    entrada: f.entrada ?? 0,
    parcelas: lerInteiro(f.parcelas) ?? 1,
    indiceCorrecao: f.indiceCorrecao,
    primeiroVencimento: f.primeiroVencimento,
    formaPagamento: f.formaPagamento.trim(),
    validadeDias: lerInteiro(f.validadeDias) ?? CONFIG_PROPOSTAS.validadePadraoDiasUteis,
    escritura: f.escritura,
    garantia: f.garantia,
  }
}

export interface ContextoValidacao {
  valorTabela: number
  minimo: number | null
  /** YYYY-MM-DD */
  hoje: string
  /** Rascunho só verifica o formato; o envio aplica todas as regras. */
  envio: boolean
}

export function validarProposta(f: FormProposta, ctx: ContextoValidacao): ErrosProposta {
  const e: ErrosProposta = {}
  const desconto = lerNumero(f.descontoPercentual)
  if (desconto === null || desconto < 0 || desconto > 100) e.descontoPercentual = 'Informe um desconto entre 0% e 100%.'
  const parcelas = lerInteiro(f.parcelas)
  if (parcelas === null || parcelas < 1 || parcelas > CONFIG_PROPOSTAS.parcelasMaximas) {
    e.parcelas = `Informe de 1 a ${CONFIG_PROPOSTAS.parcelasMaximas} parcelas.`
  }
  const validade = lerInteiro(f.validadeDias)
  if (validade === null || validade < 1 || validade > CONFIG_PROPOSTAS.validadeMaximaDiasUteis) {
    e.validadeDias = `Informe de 1 a ${CONFIG_PROPOSTAS.validadeMaximaDiasUteis} dias úteis.`
  }
  if (!ctx.envio) return e

  if (desconto !== null && !e.descontoPercentual) {
    const { valorProposto } = calcularCondicoes({ valorTabela: ctx.valorTabela, descontoPercentual: desconto, entrada: 0, parcelas: 1 })
    if (valorProposto > ctx.valorTabela) e.valorProposto = 'O valor proposto não pode passar do valor de tabela.'
    else if (ctx.minimo !== null && valorProposto < ctx.minimo) {
      e.valorProposto = `Abaixo do mínimo aceito para este imóvel (${formatarMoedaInteira(ctx.minimo)}).`
    }
    if (f.entrada !== null && f.entrada > valorProposto) e.entrada = 'A entrada não pode ser maior que o valor proposto.'
    if (acimaDaAlcada(desconto) && !f.aprovadorId) e.aprovadorId = 'Desconto acima da alçada: selecione o aprovador.'
  }
  if (f.entrada !== null && f.entrada < 0) e.entrada = 'A entrada não pode ser negativa.'
  if (!dataCalendarioValida(f.primeiroVencimento)) e.primeiroVencimento = 'Informe uma data válida.'
  else if (f.primeiroVencimento <= ctx.hoje) e.primeiroVencimento = 'O primeiro vencimento precisa ser uma data futura.'
  if (!f.indiceCorrecao) e.indiceCorrecao = 'Selecione o índice de correção.'
  if (!f.formaPagamento.trim()) e.formaPagamento = 'Informe a forma de pagamento.'
  return e
}

// ===== Fluxo de aprovação =====

interface Responsavel {
  id: string
  nome: string
  cargo: string
}

/**
 * Etapas do fluxo (RF19): envio → análise comercial (aprovador escolhido) →
 * diretoria (só acima da alçada do gestor) → contrato (automático, ainda não gerado).
 */
export function montarEtapas(dados: { autor: string; enviadaEm: string; aprovador: Responsavel; diretoria?: Responsavel }): EtapaAprovacao[] {
  const etapas: EtapaAprovacao[] = [
    {
      tipo: 'envio',
      titulo: 'Proposta enviada',
      responsavelId: '',
      responsavelNome: dados.autor,
      cargo: 'Corretor',
      estado: 'concluida',
      automatica: false,
      concluidaEm: dados.enviadaEm,
    },
    {
      tipo: 'analise_comercial',
      titulo: 'Análise comercial',
      responsavelId: dados.aprovador.id,
      responsavelNome: dados.aprovador.nome,
      cargo: dados.aprovador.cargo,
      estado: 'aguardando',
      automatica: false,
    },
  ]
  if (dados.diretoria) {
    etapas.push({
      tipo: 'diretoria',
      titulo: 'Aprovação da diretoria',
      responsavelId: dados.diretoria.id,
      responsavelNome: dados.diretoria.nome,
      cargo: dados.diretoria.cargo,
      estado: 'pendente',
      automatica: false,
    })
  }
  etapas.push({
    tipo: 'contrato',
    titulo: 'Contrato gerado',
    responsavelId: '',
    responsavelNome: 'Sistema',
    cargo: 'Automático após aprovação',
    estado: 'pendente',
    automatica: true,
  })
  return etapas
}

/** Situação da proposta enquanto a etapa indicada aguarda decisão. */
export const situacaoDaEtapa = (tipo: EtapaAprovacao['tipo']): SituacaoProposta =>
  tipo === 'diretoria' ? 'aguardando_diretoria' : 'enviada'
