import {
  adicionarDias,
  classificarReserva,
  correspondeAoFiltro,
  estenderExpiracao,
  formatarData,
  instanteExpiracao,
  lerValidade,
  reservaVazia,
  validarReserva,
} from './reservas'

const HORA = 3_600_000

describe('prazos de reserva', () => {
  it('soma a validade em dias corridos à data inicial', () => {
    expect(adicionarDias('2026-08-26', 15)).toBe('2026-09-10')
    expect(adicionarDias('2026-01-31', 1)).toBe('2026-02-01')
    expect(adicionarDias('2026-12-20', 15)).toBe('2027-01-04')
    expect(adicionarDias('2028-02-28', 1)).toBe('2028-02-29')
  })

  it('a reserva vale até o fim do dia da expiração', () => {
    const expira = new Date(instanteExpiracao('2026-08-26', 15))
    expect([expira.getFullYear(), expira.getMonth(), expira.getDate()]).toEqual([2026, 8, 10])
    expect([expira.getHours(), expira.getMinutes()]).toEqual([23, 59])
  })

  it('renovação estende a partir da expiração atual', () => {
    const atual = instanteExpiracao('2026-08-26', 15)
    expect(formatarData(estenderExpiracao(atual, 5))).toBe('15/09/2026')
  })

  it('formata datas de calendário sem deslocamento de fuso', () => {
    expect(formatarData('2026-09-10')).toBe('10/09/2026')
    expect(formatarData('invalida')).toBe('—')
  })
})

describe('classificarReserva', () => {
  const reserva = { status: 'ativa' as const, expiraEm: instanteExpiracao('2026-08-26', 0) }

  it('é crítica com menos de 24h', () => {
    expect(classificarReserva(reserva, new Date(2026, 7, 26, 19, 40).getTime())).toBe('critico')
  })

  it('pede atenção entre 24h e 48h', () => {
    expect(classificarReserva(reserva, new Date(2026, 7, 25, 12, 0).getTime())).toBe('atencao')
  })

  it('é ativa com 48h ou mais', () => {
    expect(classificarReserva(reserva, new Date(2026, 7, 23, 12, 0).getTime())).toBe('ativa')
  })

  it('é expirada após o fim do dia de expiração', () => {
    expect(classificarReserva(reserva, new Date(2026, 7, 27, 0, 0).getTime())).toBe('expirada')
  })

  it('mantém o status persistido de reservas encerradas', () => {
    expect(classificarReserva({ ...reserva, status: 'convertida' }, new Date(2026, 7, 1).getTime())).toBe('convertida')
  })

  it('"Ativas" inclui as que estão a vencer', () => {
    expect(correspondeAoFiltro('critico', 'ativas')).toBe(true)
    expect(correspondeAoFiltro('atencao', 'a_vencer')).toBe(true)
    expect(correspondeAoFiltro('ativa', 'a_vencer')).toBe(false)
    expect(correspondeAoFiltro('cancelada', 'ativas')).toBe(false)
    expect(correspondeAoFiltro('cancelada', 'todas')).toBe(true)
  })

  it('usa 24h e 48h como limites', () => {
    const agora = new Date(2026, 7, 20, 12).getTime()
    const expira = (horas: number) => ({ status: 'ativa' as const, expiraEm: new Date(agora + horas * HORA).toISOString() })
    expect(classificarReserva(expira(23.9), agora)).toBe('critico')
    expect(classificarReserva(expira(24), agora)).toBe('atencao')
    expect(classificarReserva(expira(48), agora)).toBe('ativa')
  })
})

describe('formulário de nova reserva', () => {
  it('aceita validade inteira de 1 a 365 dias', () => {
    expect(lerValidade('15')).toBe(15)
    expect(lerValidade('0')).toBeNull()
    expect(lerValidade('366')).toBeNull()
    expect(lerValidade('1.5')).toBeNull()
  })

  it('exige imóvel, cliente e responsável', () => {
    const erros = validarReserva(reservaVazia('2026-08-26'))
    expect(Object.keys(erros).sort()).toEqual(['clienteId', 'corretorId', 'imovelId', 'loteamento'])
  })

  it('mostra o bloqueio do imóvel e valida o desconto', () => {
    const form = { ...reservaVazia('2026-08-26'), loteamento: 'X', imovelId: 'imo-1', descontoPercentual: '120' }
    const erros = validarReserva(form, 'Já existe uma reserva ativa para este imóvel.')
    expect(erros.imovelId).toBe('Já existe uma reserva ativa para este imóvel.')
    expect(erros.descontoPercentual).toBe('Informe um percentual entre 0 e 100.')
  })
})
