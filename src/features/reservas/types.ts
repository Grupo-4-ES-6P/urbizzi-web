export type StatusReserva = 'ativa' | 'expirada' | 'cancelada' | 'convertida';

/** Situação exibida ao usuário: reservas ativas são classificadas pelo tempo restante. */
export type SituacaoReserva = 'ativa' | 'atencao' | 'critico' | 'expirada' | 'cancelada' | 'convertida';

export type SituacaoHistorico = SituacaoReserva | 'em_analise';

export type TipoEventoReserva = 'criacao' | 'renovacao' | 'aviso' | 'expiracao' | 'cancelamento' | 'conversao';

/** Registro de auditoria (RF32). */
export interface EventoReserva {
  id: string;
  tipo: TipoEventoReserva;
  /** Instante ISO 8601 gerado pelo servidor. */
  data: string;
  evento: string;
  responsavel: string;
  detalhe: string;
  situacao: SituacaoHistorico;
}

export interface Reserva {
  id: string;
  imovel_id: number;
  cliente_id: number;
  responsavel_id: number;
  origem_interesse: string;
  contato_recente: string;
  /** Datas de calendário no formato YYYY-MM-DD. */
  data_inicio: string;
  data_expiracao: string;
  validade_dias: number;
  renovacoes_usadas: number;
  renovacoes_permitidas: number;
  avisar_horas_antes: number;
  valor_tabela: number;
  sinal: number | null;
  forma_pagamento: string;
  desconto_percentual: number | null;
  observacoes: string;
  status: StatusReserva;
  criada_em: string;
  atualizada_em: string;
  historico: EventoReserva[];
}

export type NovaReservaInput = Pick<
  Reserva,
  | 'imovel_id'
  | 'cliente_id'
  | 'responsavel_id'
  | 'origem_interesse'
  | 'contato_recente'
  | 'data_inicio'
  | 'validade_dias'
  | 'avisar_horas_antes'
  | 'sinal'
  | 'forma_pagamento'
  | 'desconto_percentual'
  | 'observacoes'
>;

export interface RenovacaoInput {
  dias: number;
  justificativa: string;
}

export interface CancelamentoInput {
  motivo: string;
  detalhamento: string;
}

export type FiltroReservas = 'todas' | 'ativas' | 'a_vencer' | 'expiradas' | 'convertidas';
