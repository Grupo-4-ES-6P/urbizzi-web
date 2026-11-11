const MINUTO = 60_000
const DIA = 24 * 60 * MINUTO

const hora = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

/** "Agora", "Hoje · 08:41", "Ontem · 17:22", "3 dias atrás". */
export function formatarUltimoAcesso(valor: string | undefined, agora = new Date()) {
  if (!valor) return 'Nunca acessou'
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return '—'
  if (agora.getTime() - data.getTime() < 5 * MINUTO) return 'Agora'
  const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime()
  if (data.getTime() >= inicioHoje) return `Hoje · ${hora(data)}`
  if (data.getTime() >= inicioHoje - DIA) return `Ontem · ${hora(data)}`
  const dias = Math.max(2, Math.floor((inicioHoje - data.getTime()) / DIA) + 1)
  return `${dias} dias atrás`
}
