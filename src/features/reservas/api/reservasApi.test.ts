import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AGORA_TESTE, criarClienteTeste, novaReservaInput } from '../test/fixtures';
import {
  buscarReserva,
  cancelarReserva,
  criarReserva,
  listarSituacaoImoveis,
  renovarReserva,
  type CodigoErroReserva,
} from './reservasApi';

async function codigoDoErro(promessa: Promise<unknown>): Promise<CodigoErroReserva | undefined> {
  try {
    await promessa;
    return undefined;
  } catch (error) {
    return (error as { codigo?: CodigoErroReserva }).codigo;
  }
}

describe('reservasApi (mock)', () => {
  let clienteId: number;

  beforeEach(async () => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(AGORA_TESTE);
    clienteId = (await criarClienteTeste()).id_cliente;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('cria a reserva com expiração calculada, limite do loteamento e registro no histórico', async () => {
    const reserva = await criarReserva(novaReservaInput({ cliente_id: clienteId }));

    expect(reserva.id).toBe('RES-2026-0001');
    expect(reserva.status).toBe('ativa');
    expect(reserva.data_expiracao).toBe('2026-09-10');
    expect(reserva.renovacoes_permitidas).toBe(2);
    expect(reserva.historico).toHaveLength(1);
    expect(reserva.historico[0]).toMatchObject({
      evento: 'Reserva criada',
      responsavel: 'usuario teste',
      detalhe: 'Validade de 15 dias · sinal de R$ 5.000',
      situacao: 'ativa',
    });
    expect((await listarSituacaoImoveis())[103]).toBe('reservado');
  });

  it('bloqueia uma segunda reserva ativa para o mesmo imóvel (RF14)', async () => {
    await criarReserva(novaReservaInput({ cliente_id: clienteId }));

    expect(await codigoDoErro(criarReserva(novaReservaInput({ cliente_id: clienteId })))).toBe(
      'RESERVA_ATIVA_EXISTENTE',
    );
  });

  it('só reserva imóveis Disponível (RF13)', async () => {
    expect(await codigoDoErro(criarReserva(novaReservaInput({ cliente_id: clienteId, imovel_id: 105 })))).toBe(
      'IMOVEL_INDISPONIVEL',
    );
  });

  it('exige um cliente cadastrado', async () => {
    expect(await codigoDoErro(criarReserva(novaReservaInput({ cliente_id: 999 })))).toBe('CLIENTE_NAO_ENCONTRADO');
  });

  it('expira reservas vencidas e libera o imóvel (RF16), inclusive com data retroativa', async () => {
    const reserva = await criarReserva(
      novaReservaInput({ cliente_id: clienteId, data_inicio: '2026-08-01', validade_dias: 10 }),
    );

    expect(reserva.status).toBe('expirada');
    expect(reserva.historico.map((evento) => evento.evento)).toEqual(['Reserva criada', 'Reserva expirada']);
    expect((await listarSituacaoImoveis())[103]).toBe('disponivel');

    const nova = await criarReserva(novaReservaInput({ cliente_id: clienteId }));
    expect(nova.status).toBe('ativa');
  });

  it('expira uma reserva ativa quando o prazo passa', async () => {
    const reserva = await criarReserva(novaReservaInput({ cliente_id: clienteId, validade_dias: 1 }));
    vi.setSystemTime(new Date(2026, 7, 28, 0, 1));

    const atualizada = await buscarReserva(reserva.id);
    expect(atualizada?.status).toBe('expirada');
    expect(atualizada?.historico.at(-1)?.responsavel).toBe('Sistema');
  });

  it('registra aviso de vencimento dentro da janela configurada', async () => {
    const reserva = await criarReserva(novaReservaInput({ cliente_id: clienteId, data_inicio: '2026-08-12', validade_dias: 15 }));

    expect(reserva.historico.map((evento) => evento.evento)).toEqual(['Reserva criada', 'Aviso de vencimento']);
    expect(reserva.historico[1].situacao).toBe('atencao');
  });

  it('renova a partir da expiração atual e respeita o limite do loteamento (RF15)', async () => {
    // Jardim Europa permite 1 renovação.
    const reserva = await criarReserva(novaReservaInput({ cliente_id: clienteId, imovel_id: 201 }));

    const renovada = await renovarReserva(reserva.id, { dias: 5, justificativa: 'Aguardando crédito' });
    expect(renovada.data_expiracao).toBe('2026-09-15');
    expect(renovada.renovacoes_usadas).toBe(1);
    expect(renovada.historico.at(-1)).toMatchObject({
      evento: 'Reserva renovada',
      responsavel: 'usuario teste',
      detalhe: '+5 dias · Aguardando crédito',
    });

    expect(await codigoDoErro(renovarReserva(reserva.id, { dias: 5, justificativa: 'De novo' }))).toBe(
      'LIMITE_RENOVACOES',
    );
  });

  it('exige justificativa na renovação', async () => {
    const reserva = await criarReserva(novaReservaInput({ cliente_id: clienteId }));
    expect(await codigoDoErro(renovarReserva(reserva.id, { dias: 5, justificativa: '  ' }))).toBe('DADOS_INVALIDOS');
  });

  it('cancelamento libera o imóvel imediatamente e mantém o histórico', async () => {
    const reserva = await criarReserva(novaReservaInput({ cliente_id: clienteId }));

    const cancelada = await cancelarReserva(reserva.id, { motivo: 'Desistência do cliente', detalhamento: '' });
    expect(cancelada.status).toBe('cancelada');
    expect(cancelada.historico.map((evento) => evento.evento)).toEqual(['Reserva criada', 'Reserva cancelada']);
    expect((await listarSituacaoImoveis())[103]).toBe('disponivel');

    expect(await codigoDoErro(renovarReserva(reserva.id, { dias: 5, justificativa: 'x' }))).toBe('RESERVA_NAO_ATIVA');
  });
});
