import { describe, expect, it } from 'vitest';
import {
  adicionarDias,
  calcularDataExpiracao,
  classificarReserva,
  correspondeAoFiltro,
  formatarData,
  formatarTempoRestante,
} from './prazo';

const HORA = 60 * 60 * 1000;

describe('calcularDataExpiracao', () => {
  it('soma a validade em dias corridos à data inicial', () => {
    expect(calcularDataExpiracao('2026-08-26', 15)).toBe('2026-09-10');
  });

  it('atravessa meses e anos', () => {
    expect(calcularDataExpiracao('2026-01-31', 1)).toBe('2026-02-01');
    expect(calcularDataExpiracao('2026-12-20', 15)).toBe('2027-01-04');
    expect(calcularDataExpiracao('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('renovação estende a partir da expiração atual', () => {
    expect(adicionarDias('2026-08-26', 15)).toBe('2026-09-10');
  });
});

describe('formatarTempoRestante', () => {
  it('mostra horas e minutos abaixo de um dia', () => {
    expect(formatarTempoRestante(4 * HORA + 20 * 60 * 1000)).toBe('4h 20min');
    expect(formatarTempoRestante(35 * 60 * 1000)).toBe('35min');
  });

  it('mostra dias a partir de 24h', () => {
    expect(formatarTempoRestante(30 * HORA)).toBe('1 dia');
    expect(formatarTempoRestante(3 * 24 * HORA + HORA)).toBe('3 dias');
  });

  it('indica expiração quando não há tempo restante', () => {
    expect(formatarTempoRestante(0)).toBe('Expirada');
  });
});

describe('classificarReserva', () => {
  // A reserva vale até 23:59:59.999 do dia de expiração.
  const reserva = { status: 'ativa' as const, data_expiracao: '2026-08-26' };

  it('é crítica com menos de 24h', () => {
    expect(classificarReserva(reserva, new Date(2026, 7, 26, 19, 40))).toBe('critico');
  });

  it('pede atenção entre 24h e 48h', () => {
    expect(classificarReserva(reserva, new Date(2026, 7, 25, 12, 0))).toBe('atencao');
  });

  it('é ativa com 48h ou mais', () => {
    expect(classificarReserva(reserva, new Date(2026, 7, 23, 12, 0))).toBe('ativa');
  });

  it('é expirada após o fim do dia de expiração', () => {
    expect(classificarReserva(reserva, new Date(2026, 7, 27, 0, 0))).toBe('expirada');
  });

  it('mantém o status persistido de reservas encerradas', () => {
    expect(classificarReserva({ ...reserva, status: 'convertida' }, new Date(2026, 7, 1))).toBe('convertida');
  });
});

describe('correspondeAoFiltro', () => {
  it('"Ativas" inclui as que estão a vencer', () => {
    expect(correspondeAoFiltro('critico', 'ativas')).toBe(true);
    expect(correspondeAoFiltro('atencao', 'a_vencer')).toBe(true);
    expect(correspondeAoFiltro('ativa', 'a_vencer')).toBe(false);
    expect(correspondeAoFiltro('cancelada', 'ativas')).toBe(false);
    expect(correspondeAoFiltro('cancelada', 'todas')).toBe(true);
  });
});

describe('formatarData', () => {
  it('formata datas de calendário sem deslocamento de fuso', () => {
    expect(formatarData('2026-09-10')).toBe('10/09/2026');
  });
});
