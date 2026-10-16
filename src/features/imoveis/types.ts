export interface Loteamento {
  id: number;
  nome: string;
  /** Limite de renovações de reserva definido pelo loteamento (RF15). */
  limite_renovacoes: number;
}

/** Situação cadastral do imóvel no catálogo; "Reservado" é derivado das reservas ativas. */
export type SituacaoCadastralImovel = 'disponivel' | 'vendido';

export type SituacaoImovel = 'disponivel' | 'reservado' | 'vendido';

export interface Imovel {
  id: number;
  loteamento_id: number;
  quadra: string | null;
  lote: string;
  matricula: string;
  valor_tabela: number;
  situacao_cadastral: SituacaoCadastralImovel;
}

export const SITUACAO_IMOVEL_LABEL: Record<SituacaoImovel, string> = {
  disponivel: 'Disponível',
  reservado: 'Reservado',
  vendido: 'Vendido',
};
