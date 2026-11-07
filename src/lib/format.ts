const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const moedaInteira = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})
const moedaCompacta = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
})
const decimal = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const formatarMoeda = (v: number) => moeda.format(v)
export const formatarMoedaInteira = (v: number) => moedaInteira.format(v)
export const formatarMoedaCompacta = (v: number) => moedaCompacta.format(v)
export const formatarDecimal = (v: number) => decimal.format(v)

const umaCasa = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

/** Espaço não separável, o mesmo que o Intl usa entre "R$" e o número. */
const NBSP = String.fromCodePoint(160)

/** "R$ 4,2M" / "R$ 850 mil": o compacto do Intl em pt-BR escreve "mi", diferente do protótipo. */
export function formatarMoedaAbreviada(v: number) {
  const abs = Math.abs(v)
  if (abs >= 999_950) return `R$${NBSP}${umaCasa.format(v / 1_000_000)}M`
  if (abs >= 1_000) return `R$${NBSP}${umaCasa.format(v / 1_000)}${NBSP}mil`
  return formatarMoedaInteira(v)
}

export function formatarDataExtensa(data: Date) {
  const texto = data.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export function nomeMes(data: Date) {
  return data.toLocaleDateString('pt-BR', { month: 'long' })
}

const HORA = 3_600_000

export function formatarTempoRestante(ms: number) {
  if (ms <= 0) return 'Expirada'
  const horas = Math.floor(ms / HORA)
  if (horas < 24) {
    const minutos = Math.floor((ms % HORA) / 60_000)
    return horas === 0 ? `${minutos}min` : `${horas}h ${pad(minutos)}min`
  }
  const dias = Math.floor(horas / 24)
  return `${dias} ${dias === 1 ? 'dia' : 'dias'}`
}

const pad = (n: number) => String(n).padStart(2, '0')

export type Urgencia = 'critico' | 'atencao' | 'normal'

export function urgenciaReserva(ms: number): Urgencia {
  if (ms < 24 * HORA) return 'critico'
  if (ms < 72 * HORA) return 'atencao'
  return 'normal'
}

export function dataCalendario(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Formata YYYY-MM-DD ou um instante ISO como DD/MM/AAAA. */
export function formatarData(valor: string) {
  const calendario = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor)
  const d = calendario
    ? new Date(Number(calendario[1]), Number(calendario[2]) - 1, Number(calendario[3]))
    : new Date(valor)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR')
}

export function mascaraCep(valor: string) {
  const d = valor.replace(/\D/g, '').slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

export function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/)
  const primeira = partes[0]?.[0] ?? ''
  const ultima = partes.length > 1 ? (partes.at(-1)?.[0] ?? '') : ''
  return (primeira + ultima).toUpperCase()
}

/** Remove acentos e caixa para comparar textos em buscas. */
export function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}
