import { buscarClientePorId } from '../../../api/clientes/clientes';
import { buscarImovel, buscarLoteamento, listarImoveis } from '../../imoveis/api/imoveisApi';
import type { SituacaoImovel } from '../../imoveis/types';
import { buscarCorretor } from '../../usuarios/api/corretoresApi';
import type {
  CancelamentoInput,
  EventoReserva,
  NovaReservaInput,
  RenovacaoInput,
  Reserva,
  TipoEventoReserva,
} from '../types';
import {
  adicionarDias,
  calcularDataExpiracao,
  classificarReserva,
  instanteExpiracao,
  isDataCalendarioValida,
  msRestantes,
} from '../utils/prazo';
import { formatarMoeda } from '../utils/formatacao';

/*
 * Servidor mock de Reservas, persistido em localStorage.
 * Todas as regras de negócio (RF13–RF16, RF32) ficam aqui, como ficariam no backend:
 * para integrar a API real, basta trocar o corpo destas funções por chamadas HTTP
 * mantendo as mesmas assinaturas.
 */

const STORAGE_KEY = 'urbizzi:reservas';
const AUTOR_SISTEMA = 'Sistema';
/** Autor das ações manuais enquanto não há autenticação; trocar pelo usuário logado. */
const AUTOR_USUARIO = 'usuario teste';

export type CodigoErroReserva =
  | 'IMOVEL_NAO_ENCONTRADO'
  | 'IMOVEL_INDISPONIVEL'
  | 'RESERVA_ATIVA_EXISTENTE'
  | 'CLIENTE_NAO_ENCONTRADO'
  | 'RESPONSAVEL_NAO_ENCONTRADO'
  | 'DADOS_INVALIDOS'
  | 'RESERVA_NAO_ENCONTRADA'
  | 'RESERVA_NAO_ATIVA'
  | 'LIMITE_RENOVACOES';

export class ReservaError extends Error {
  readonly codigo: CodigoErroReserva;

  constructor(codigo: CodigoErroReserva, mensagem: string) {
    super(mensagem);
    this.name = 'ReservaError';
    this.codigo = codigo;
  }
}

/** Relógio do "servidor". No backend real, datas e prazos vêm da resposta da API. */
function agoraServidor(): Date {
  return new Date();
}

function lerReservas(): Reserva[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const dados = JSON.parse(raw) as Reserva[];
    return Array.isArray(dados) ? dados : [];
  } catch {
    return [];
  }
}

function salvarReservas(reservas: Reserva[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reservas));
}

function novoEvento(
  tipo: TipoEventoReserva,
  data: Date,
  dados: Pick<EventoReserva, 'evento' | 'responsavel' | 'detalhe' | 'situacao'>,
): EventoReserva {
  return { id: `${tipo}-${data.getTime()}-${Math.random().toString(36).slice(2, 8)}`, tipo, data: data.toISOString(), ...dados };
}

function proximoId(reservas: Reserva[], agora: Date): string {
  const ano = agora.getFullYear();
  const prefixo = `RES-${ano}-`;
  const maior = reservas
    .filter((reserva) => reserva.id.startsWith(prefixo))
    .reduce((max, reserva) => Math.max(max, Number(reserva.id.slice(prefixo.length)) || 0), 0);
  return `${prefixo}${String(maior + 1).padStart(4, '0')}`;
}

function inicioDoCicloAtual(reserva: Reserva): string {
  const marcos = reserva.historico.filter((evento) => evento.tipo === 'criacao' || evento.tipo === 'renovacao');
  return marcos.length > 0 ? marcos[marcos.length - 1].data : reserva.criada_em;
}

/**
 * Aplica as transições automáticas de prazo:
 * - RF16: reserva ativa vencida expira e o imóvel volta a ficar Disponível;
 * - aviso ao responsável dentro da janela configurada, uma vez por ciclo (criação/renovação).
 */
function sincronizarPrazos(reservas: Reserva[], agora: Date): { reservas: Reserva[]; alterou: boolean } {
  let alterou = false;

  const atualizadas = reservas.map((reserva) => {
    if (reserva.status !== 'ativa') return reserva;

    const restante = msRestantes(reserva.data_expiracao, agora);

    if (restante <= 0) {
      alterou = true;
      // Com data inicial retroativa a expiração pode ser anterior ao cadastro; o registro nunca precede a criação.
      const expirouEm = new Date(
        Math.max(instanteExpiracao(reserva.data_expiracao).getTime(), new Date(reserva.criada_em).getTime()),
      );
      return {
        ...reserva,
        status: 'expirada' as const,
        atualizada_em: agora.toISOString(),
        historico: [
          ...reserva.historico,
          novoEvento('expiracao', expirouEm, {
            evento: 'Reserva expirada',
            responsavel: AUTOR_SISTEMA,
            detalhe: 'Sem renovação, o imóvel voltou para Disponível',
            situacao: 'expirada',
          }),
        ],
      };
    }

    const dentroDaJanela = restante <= reserva.avisar_horas_antes * 60 * 60 * 1000;
    const inicioCiclo = inicioDoCicloAtual(reserva);
    const jaAvisado = reserva.historico.some((evento) => evento.tipo === 'aviso' && evento.data >= inicioCiclo);

    if (dentroDaJanela && !jaAvisado) {
      alterou = true;
      const situacao = classificarReserva(reserva, agora);
      return {
        ...reserva,
        historico: [
          ...reserva.historico,
          novoEvento('aviso', agora, {
            evento: 'Aviso de vencimento',
            responsavel: AUTOR_SISTEMA,
            detalhe: 'E-mail e alerta no painel do responsável',
            situacao: situacao === 'critico' ? 'critico' : 'atencao',
          }),
        ],
      };
    }

    return reserva;
  });

  return { reservas: atualizadas, alterou };
}

function lerReservasSincronizadas(): Reserva[] {
  const { reservas, alterou } = sincronizarPrazos(lerReservas(), agoraServidor());
  if (alterou) salvarReservas(reservas);
  return reservas;
}

function situacaoDoImovel(imovelId: number, situacaoCadastral: 'disponivel' | 'vendido', reservas: Reserva[]): SituacaoImovel {
  if (situacaoCadastral === 'vendido') return 'vendido';
  const doImovel = reservas.filter((reserva) => reserva.imovel_id === imovelId);
  if (doImovel.some((reserva) => reserva.status === 'convertida')) return 'vendido';
  if (doImovel.some((reserva) => reserva.status === 'ativa')) return 'reservado';
  return 'disponivel';
}

function textoDias(dias: number): string {
  return dias === 1 ? '1 dia' : `${dias} dias`;
}

export async function listarReservas(): Promise<Reserva[]> {
  return lerReservasSincronizadas();
}

export async function buscarReserva(id: string): Promise<Reserva | undefined> {
  return lerReservasSincronizadas().find((reserva) => reserva.id === id);
}

/** Situação efetiva de cada imóvel do catálogo, considerando as reservas (RF13/RF14/RF16). */
export async function listarSituacaoImoveis(): Promise<Record<number, SituacaoImovel>> {
  const reservas = lerReservasSincronizadas();
  const imoveis = await listarImoveis();
  return Object.fromEntries(
    imoveis.map((imovel) => [imovel.id, situacaoDoImovel(imovel.id, imovel.situacao_cadastral, reservas)]),
  );
}

export async function criarReserva(dados: NovaReservaInput): Promise<Reserva> {
  const agora = agoraServidor();
  const reservas = lerReservasSincronizadas();

  const imovel = await buscarImovel(dados.imovel_id);
  if (!imovel) throw new ReservaError('IMOVEL_NAO_ENCONTRADO', 'Imóvel não encontrado.');

  // RF14: não permite duas reservas ativas para o mesmo imóvel.
  if (reservas.some((reserva) => reserva.imovel_id === imovel.id && reserva.status === 'ativa')) {
    throw new ReservaError('RESERVA_ATIVA_EXISTENTE', 'Já existe uma reserva ativa para este imóvel.');
  }

  // RF13: somente imóveis Disponível podem ser reservados.
  if (situacaoDoImovel(imovel.id, imovel.situacao_cadastral, reservas) !== 'disponivel') {
    throw new ReservaError('IMOVEL_INDISPONIVEL', 'Somente imóveis com situação Disponível podem ser reservados.');
  }

  const cliente = await buscarClientePorId(dados.cliente_id);
  if (!cliente) throw new ReservaError('CLIENTE_NAO_ENCONTRADO', 'Cliente não encontrado.');

  const responsavel = await buscarCorretor(dados.responsavel_id);
  if (!responsavel) throw new ReservaError('RESPONSAVEL_NAO_ENCONTRADO', 'Responsável comercial não encontrado.');

  if (!isDataCalendarioValida(dados.data_inicio) || !Number.isInteger(dados.validade_dias) || dados.validade_dias < 1) {
    throw new ReservaError('DADOS_INVALIDOS', 'Data inicial ou validade inválida.');
  }

  const loteamento = await buscarLoteamento(imovel.loteamento_id);

  const sinal = dados.sinal === null ? '' : ` · sinal de ${formatarMoeda(dados.sinal)}`;

  const reserva: Reserva = {
    id: proximoId(reservas, agora),
    imovel_id: imovel.id,
    cliente_id: cliente.id_cliente,
    responsavel_id: responsavel.id,
    origem_interesse: dados.origem_interesse.trim(),
    contato_recente: dados.contato_recente.trim(),
    data_inicio: dados.data_inicio,
    data_expiracao: calcularDataExpiracao(dados.data_inicio, dados.validade_dias),
    validade_dias: dados.validade_dias,
    renovacoes_usadas: 0,
    renovacoes_permitidas: loteamento?.limite_renovacoes ?? 0,
    avisar_horas_antes: dados.avisar_horas_antes,
    valor_tabela: imovel.valor_tabela,
    sinal: dados.sinal,
    forma_pagamento: dados.forma_pagamento.trim(),
    desconto_percentual: dados.desconto_percentual,
    observacoes: dados.observacoes.trim(),
    status: 'ativa',
    criada_em: agora.toISOString(),
    atualizada_em: agora.toISOString(),
    historico: [
      novoEvento('criacao', agora, {
        evento: 'Reserva criada',
        responsavel: AUTOR_USUARIO,
        detalhe: `Validade de ${textoDias(dados.validade_dias)}${sinal}`,
        situacao: 'ativa',
      }),
    ],
  };

  // Reservas com data inicial retroativa podem já nascer expiradas (RF16).
  const { reservas: sincronizadas } = sincronizarPrazos([...reservas, reserva], agora);
  salvarReservas(sincronizadas);

  return sincronizadas[sincronizadas.length - 1];
}

function obterReservaAtiva(reservas: Reserva[], id: string): { reserva: Reserva; index: number } {
  const index = reservas.findIndex((reserva) => reserva.id === id);
  if (index === -1) throw new ReservaError('RESERVA_NAO_ENCONTRADA', `Reserva ${id} não encontrada.`);

  const reserva = reservas[index];
  if (reserva.status !== 'ativa') {
    throw new ReservaError('RESERVA_NAO_ATIVA', 'Somente reservas ativas podem ser alteradas.');
  }

  return { reserva, index };
}

/** RF15: estende a validade a partir da expiração atual, respeitando o limite do loteamento. */
export async function renovarReserva(id: string, dados: RenovacaoInput): Promise<Reserva> {
  const agora = agoraServidor();
  const reservas = lerReservasSincronizadas();
  const { reserva, index } = obterReservaAtiva(reservas, id);

  if (reserva.renovacoes_usadas >= reserva.renovacoes_permitidas) {
    throw new ReservaError('LIMITE_RENOVACOES', 'Limite de renovações do loteamento atingido.');
  }

  const justificativa = dados.justificativa.trim();
  if (!Number.isInteger(dados.dias) || dados.dias < 1 || !justificativa) {
    throw new ReservaError('DADOS_INVALIDOS', 'Informe a nova validade e a justificativa.');
  }

  const atualizada: Reserva = {
    ...reserva,
    data_expiracao: adicionarDias(reserva.data_expiracao, dados.dias),
    renovacoes_usadas: reserva.renovacoes_usadas + 1,
    atualizada_em: agora.toISOString(),
    historico: [
      ...reserva.historico,
      novoEvento('renovacao', agora, {
        evento: 'Reserva renovada',
        responsavel: AUTOR_USUARIO,
        detalhe: `+${textoDias(dados.dias)} · ${justificativa}`,
        situacao: 'ativa',
      }),
    ],
  };

  reservas[index] = atualizada;
  salvarReservas(reservas);
  return atualizada;
}

/** Cancela a reserva, liberando o imóvel imediatamente e mantendo o histórico. */
export async function cancelarReserva(id: string, dados: CancelamentoInput): Promise<Reserva> {
  const agora = agoraServidor();
  const reservas = lerReservasSincronizadas();
  const { reserva, index } = obterReservaAtiva(reservas, id);

  const motivo = dados.motivo.trim();
  if (!motivo) throw new ReservaError('DADOS_INVALIDOS', 'Informe o motivo do cancelamento.');

  const detalhamento = dados.detalhamento.trim();
  const atualizada: Reserva = {
    ...reserva,
    status: 'cancelada',
    atualizada_em: agora.toISOString(),
    historico: [
      ...reserva.historico,
      novoEvento('cancelamento', agora, {
        evento: 'Reserva cancelada',
        responsavel: AUTOR_USUARIO,
        detalhe: [motivo, detalhamento, 'imóvel liberado'].filter(Boolean).join(' · '),
        situacao: 'cancelada',
      }),
    ],
  };

  reservas[index] = atualizada;
  salvarReservas(reservas);
  return atualizada;
}
