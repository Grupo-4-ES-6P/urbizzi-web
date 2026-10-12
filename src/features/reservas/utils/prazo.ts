import type { FiltroReservas, Reserva, SituacaoReserva } from '../types';

const MS_POR_MINUTO = 60 * 1000;
const MS_POR_HORA = 60 * MS_POR_MINUTO;
const MS_POR_DIA = 24 * MS_POR_HORA;

/** Abaixo deste tempo restante a reserva é "Crítico". */
export const LIMITE_CRITICO_HORAS = 24;
/** Abaixo deste tempo restante a reserva está "A vencer" / "Atenção". */
export const LIMITE_A_VENCER_HORAS = 48;

function parseDataCalendario(data: string): { ano: number; mes: number; dia: number } {
  const [ano, mes, dia] = data.split('-').map(Number);
  return { ano, mes, dia };
}

function paraDataCalendario(date: Date): string {
  const ano = date.getFullYear();
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  const dia = String(date.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

export function isDataCalendarioValida(data: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
  const { ano, mes, dia } = parseDataCalendario(data);
  const date = new Date(ano, mes - 1, dia);
  return date.getFullYear() === ano && date.getMonth() === mes - 1 && date.getDate() === dia;
}

/** Soma dias corridos a uma data YYYY-MM-DD. */
export function adicionarDias(data: string, dias: number): string {
  const { ano, mes, dia } = parseDataCalendario(data);
  return paraDataCalendario(new Date(ano, mes - 1, dia + dias));
}

/** Data de expiração = data inicial + validade em dias corridos (RF13). */
export function calcularDataExpiracao(dataInicio: string, validadeDias: number): string {
  return adicionarDias(dataInicio, validadeDias);
}

/** A reserva vale até o fim do dia da data de expiração (horário local). */
export function instanteExpiracao(dataExpiracao: string): Date {
  const { ano, mes, dia } = parseDataCalendario(dataExpiracao);
  return new Date(ano, mes - 1, dia, 23, 59, 59, 999);
}

export function hojeCalendario(agora: Date): string {
  return paraDataCalendario(agora);
}

export function msRestantes(dataExpiracao: string, agora: Date): number {
  return instanteExpiracao(dataExpiracao).getTime() - agora.getTime();
}

/** "4h 20min", "35min", "1 dia", "3 dias". */
export function formatarTempoRestante(ms: number): string {
  if (ms <= 0) return 'Expirada';

  if (ms < MS_POR_DIA) {
    const horas = Math.floor(ms / MS_POR_HORA);
    const minutos = Math.floor((ms % MS_POR_HORA) / MS_POR_MINUTO);
    if (horas === 0) return `${Math.max(minutos, 1)}min`;
    return `${horas}h ${String(minutos).padStart(2, '0')}min`;
  }

  const dias = Math.floor(ms / MS_POR_DIA);
  return dias === 1 ? '1 dia' : `${dias} dias`;
}

export function classificarReserva(reserva: Pick<Reserva, 'status' | 'data_expiracao'>, agora: Date): SituacaoReserva {
  if (reserva.status !== 'ativa') return reserva.status;

  const restante = msRestantes(reserva.data_expiracao, agora);
  if (restante <= 0) return 'expirada';
  if (restante < LIMITE_CRITICO_HORAS * MS_POR_HORA) return 'critico';
  if (restante < LIMITE_A_VENCER_HORAS * MS_POR_HORA) return 'atencao';
  return 'ativa';
}

export function correspondeAoFiltro(situacao: SituacaoReserva, filtro: FiltroReservas): boolean {
  switch (filtro) {
    case 'todas':
      return true;
    case 'ativas':
      return situacao === 'ativa' || situacao === 'atencao' || situacao === 'critico';
    case 'a_vencer':
      return situacao === 'atencao' || situacao === 'critico';
    case 'expiradas':
      return situacao === 'expirada';
    case 'convertidas':
      return situacao === 'convertida';
  }
}

/** Formata YYYY-MM-DD ou um instante ISO como DD/MM/AAAA. */
export function formatarData(valor: string): string {
  let date: Date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const { ano, mes, dia } = parseDataCalendario(valor);
    date = new Date(ano, mes - 1, dia);
  } else {
    date = new Date(valor);
  }
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleDateString('pt-BR');
}

/** Rótulo do status persistido (sem a classificação por prazo), ex.: campo "Status" do detalhe. */
export const STATUS_RESERVA_LABEL: Record<SituacaoReserva, string> = {
  ativa: 'Ativa',
  atencao: 'Ativa',
  critico: 'Ativa',
  expirada: 'Expirada',
  cancelada: 'Cancelada',
  convertida: 'Convertida',
};
