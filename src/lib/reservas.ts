import type { Reserva, SituacaoReserva, VarianteBadge } from '../data/types'

const MINUTO = 60_000
const HORA = 60 * MINUTO

/** Abaixo deste tempo restante a reserva é "Crítico". */
export const LIMITE_CRITICO_HORAS = 24
/** Abaixo deste tempo restante a reserva está "A vencer" / "Atenção". */
export const LIMITE_A_VENCER_HORAS = 48
export const VALIDADE_MAXIMA_DIAS = 365

// ===== Datas de calendário (YYYY-MM-DD, horário local) =====

function partes(data: string) {
  const [ano, mes, dia] = data.split('-').map(Number)
  return { ano, mes, dia }
}

export function dataCalendario(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function dataCalendarioValida(data: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return false
  const { ano, mes, dia } = partes(data)
  const d = new Date(ano, mes - 1, dia)
  return d.getFullYear() === ano && d.getMonth() === mes - 1 && d.getDate() === dia
}

/** Soma dias corridos a uma data YYYY-MM-DD. */
export function adicionarDias(data: string, dias: number) {
  const { ano, mes, dia } = partes(data)
  return dataCalendario(new Date(ano, mes - 1, dia + dias))
}

/** A reserva vale até o fim do dia da expiração: data inicial + validade em dias corridos (RF13). */
export function instanteExpiracao(dataInicio: string, validadeDias: number) {
  const { ano, mes, dia } = partes(adicionarDias(dataInicio, validadeDias))
  return new Date(ano, mes - 1, dia, 23, 59, 59, 999).toISOString()
}

/** Renovação estende a partir da expiração atual, mantendo o horário (RF15). */
export function estenderExpiracao(expiraEm: string, dias: number) {
  const d = new Date(expiraEm)
  d.setDate(d.getDate() + dias)
  return d.toISOString()
}

/** Formata YYYY-MM-DD ou um instante ISO como DD/MM/AAAA. */
export function formatarData(valor: string) {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(valor)
    ? new Date(partes(valor).ano, partes(valor).mes - 1, partes(valor).dia)
    : new Date(valor)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR')
}

// ===== Situação =====

export function classificarReserva(r: Pick<Reserva, 'status' | 'expiraEm'>, agora: number): SituacaoReserva {
  if (r.status !== 'ativa') return r.status
  const restante = new Date(r.expiraEm).getTime() - agora
  if (restante <= 0) return 'expirada'
  if (restante < LIMITE_CRITICO_HORAS * HORA) return 'critico'
  if (restante < LIMITE_A_VENCER_HORAS * HORA) return 'atencao'
  return 'ativa'
}

export const SITUACAO_RESERVA: Record<SituacaoReserva, { rotulo: string; variante: VarianteBadge }> = {
  ativa: { rotulo: 'Ativa', variante: 'normal' },
  atencao: { rotulo: 'Atenção', variante: 'atencao' },
  critico: { rotulo: 'Crítico', variante: 'critico' },
  expirada: { rotulo: 'Expirada', variante: 'neutro' },
  cancelada: { rotulo: 'Cancelada', variante: 'neutro' },
  convertida: { rotulo: 'Vendida', variante: 'laranja' },
}

/** Rótulo do status persistido, sem a classificação por prazo. */
export const STATUS_RESERVA: Record<SituacaoReserva, string> = {
  ativa: 'Ativa',
  atencao: 'Ativa',
  critico: 'Ativa',
  expirada: 'Expirada',
  cancelada: 'Cancelada',
  convertida: 'Convertida',
}

export type FiltroReservas = 'todas' | 'ativas' | 'a_vencer' | 'expiradas' | 'convertidas'

export const FILTROS_RESERVA: { valor: FiltroReservas; rotulo: string }[] = [
  { valor: 'todas', rotulo: 'Todas' },
  { valor: 'ativas', rotulo: 'Ativas' },
  { valor: 'a_vencer', rotulo: 'A vencer' },
  { valor: 'expiradas', rotulo: 'Expiradas' },
  { valor: 'convertidas', rotulo: 'Convertidas' },
]

export function correspondeAoFiltro(s: SituacaoReserva, filtro: FiltroReservas) {
  switch (filtro) {
    case 'todas':
      return true
    case 'ativas':
      return s === 'ativa' || s === 'atencao' || s === 'critico'
    case 'a_vencer':
      return s === 'atencao' || s === 'critico'
    case 'expiradas':
      return s === 'expirada'
    case 'convertidas':
      return s === 'convertida'
  }
}

export const MOTIVOS_CANCELAMENTO_RESERVA = [
  'Desistência do cliente',
  'Crédito não aprovado',
  'Troca de imóvel',
  'Erro de cadastro',
  'Outro',
]

export const OPCOES_AVISO_HORAS = [24, 48, 72]

// ===== Formulário de nova reserva =====

export interface FormReserva {
  loteamento: string
  imovelId: string
  clienteId: string
  corretorId: string
  origemInteresse: string
  contatoRecente: string
  dataInicio: string
  validadeDias: string
  avisarHorasAntes: number
  sinal: number | null
  formaPagamento: string
  descontoPercentual: string
  observacoes: string
}

export type ErrosReserva = Partial<Record<keyof FormReserva, string>>

export function reservaVazia(hoje: string): FormReserva {
  return {
    loteamento: '',
    imovelId: '',
    clienteId: '',
    corretorId: '',
    origemInteresse: '',
    contatoRecente: '',
    dataInicio: hoje,
    validadeDias: '15',
    avisarHorasAntes: 48,
    sinal: null,
    formaPagamento: '',
    descontoPercentual: '',
    observacoes: '',
  }
}

export function lerValidade(valor: string) {
  if (!/^\d+$/.test(valor.trim())) return null
  const dias = Number(valor)
  return dias >= 1 && dias <= VALIDADE_MAXIMA_DIAS ? dias : null
}

export function validarReserva(f: FormReserva, bloqueioImovel?: string): ErrosReserva {
  const e: ErrosReserva = {}
  if (!f.loteamento) e.loteamento = 'Selecione o loteamento.'
  if (!f.imovelId) e.imovelId = 'Selecione a quadra e o lote.'
  else if (bloqueioImovel) e.imovelId = bloqueioImovel
  if (!f.clienteId) e.clienteId = 'Selecione um cliente cadastrado.'
  if (!f.corretorId) e.corretorId = 'Selecione o responsável comercial.'
  if (!dataCalendarioValida(f.dataInicio)) e.dataInicio = 'Informe uma data válida.'
  if (lerValidade(f.validadeDias) === null) e.validadeDias = `Informe um número inteiro de 1 a ${VALIDADE_MAXIMA_DIAS}.`
  const desconto = f.descontoPercentual.trim()
  if (desconto && (Number.isNaN(Number(desconto)) || Number(desconto) < 0 || Number(desconto) > 100)) {
    e.descontoPercentual = 'Informe um percentual entre 0 e 100.'
  }
  return e
}
