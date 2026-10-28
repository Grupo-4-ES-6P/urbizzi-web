import { reservaAtiva } from '../data/selectors'
import type { CanalContato, Cliente, ContatoComercial, Db, Reserva, ResultadoContato, VarianteBadge } from '../data/types'
import { urgenciaReserva } from './format'

// ===== Catálogos do cadastro comercial (RF11, RF12) =====

export const ORIGENS_CLIENTE = [
  'Catálogo público',
  'Indicação',
  'WhatsApp',
  'Telefone',
  'Visita presencial',
  'Redes sociais',
  'Parceiro',
  'Outro',
]

export const CANAIS_CONTATO: CanalContato[] = ['WhatsApp', 'Telefone', 'E-mail', 'Visita presencial', 'Catálogo público']

export const RESULTADO_CONTATO: Record<ResultadoContato, { rotulo: string; variante: VarianteBadge }> = {
  em_andamento: { rotulo: 'Em andamento', variante: 'escuro' },
  positivo: { rotulo: 'Positivo', variante: 'normal' },
  sem_retorno: { rotulo: 'Sem retorno', variante: 'escuro' },
  negativo: { rotulo: 'Negativo', variante: 'critico' },
  novo: { rotulo: 'Novo', variante: 'atencao' },
}

export const RESULTADOS_CONTATO = Object.keys(RESULTADO_CONTATO) as ResultadoContato[]

/** Mais recente primeiro; empate na data mantém a ordem de registro. */
export function ordenarContatos(contatos: ContatoComercial[]) {
  return [...contatos].sort((a, b) => b.data.localeCompare(a.data))
}

export function ultimoContato(cliente: Pick<Cliente, 'contatos'>): ContatoComercial | undefined {
  return ordenarContatos(cliente.contatos)[0]
}

// ===== Situação comercial exibida na lista =====

export type SituacaoCliente =
  | 'inativo'
  | 'venda_concluida'
  | 'reserva_ativa'
  | 'proposta_enviada'
  | 'parceiro'
  | 'em_negociacao'
  | 'sem_retorno'
  | 'novo'
  | 'cliente_ativo'

export const SITUACAO_CLIENTE: Record<SituacaoCliente, { rotulo: string; variante: VarianteBadge }> = {
  inativo: { rotulo: 'Inativo', variante: 'neutro' },
  venda_concluida: { rotulo: 'Venda concluída', variante: 'normal' },
  reserva_ativa: { rotulo: 'Reserva ativa', variante: 'atencao' },
  proposta_enviada: { rotulo: 'Proposta enviada', variante: 'escuro' },
  parceiro: { rotulo: 'Parceiro', variante: 'escuro' },
  em_negociacao: { rotulo: 'Em negociação', variante: 'escuro' },
  sem_retorno: { rotulo: 'Sem retorno', variante: 'escuro' },
  novo: { rotulo: 'Novo', variante: 'atencao' },
  cliente_ativo: { rotulo: 'Cliente ativo', variante: 'normal' },
}

export interface VinculosClientes {
  comVenda: Set<string>
  comReservaAtiva: Set<string>
  comPropostaEmAndamento: Set<string>
}

/** Calculado uma vez para a lista inteira, em vez de varrer o banco por cliente. */
export function vinculosClientes(db: Pick<Db, 'vendas' | 'reservas' | 'propostas'>, agora: number): VinculosClientes {
  return {
    comVenda: new Set(db.vendas.filter((v) => v.status === 'ativa').map((v) => v.clienteId)),
    comReservaAtiva: new Set(db.reservas.filter((r) => reservaAtiva(r, agora)).map((r) => r.clienteId)),
    comPropostaEmAndamento: new Set(db.propostas.filter((p) => p.status === 'pendente').map((p) => p.clienteId)),
  }
}

/**
 * Situação comercial do cliente. Os vínculos com venda, reserva e proposta
 * pesam mais que o último contato registrado.
 */
export function situacaoCliente(cliente: Cliente, vinculos: VinculosClientes): SituacaoCliente {
  if (!cliente.ativo) return 'inativo'
  if (vinculos.comVenda.has(cliente.id)) return 'venda_concluida'
  if (vinculos.comReservaAtiva.has(cliente.id)) return 'reserva_ativa'
  if (vinculos.comPropostaEmAndamento.has(cliente.id)) return 'proposta_enviada'
  if (cliente.origem === 'Parceiro') return 'parceiro'
  const ultimo = ultimoContato(cliente)
  if (!ultimo || ultimo.resultado === 'novo') return 'novo'
  if (ultimo.resultado === 'em_andamento') return 'em_negociacao'
  if (ultimo.resultado === 'sem_retorno') return 'sem_retorno'
  return 'cliente_ativo'
}

const SITUACAO_RESERVA_ATIVA: Record<ReturnType<typeof urgenciaReserva>, { rotulo: string; variante: VarianteBadge }> = {
  normal: { rotulo: 'Ativa', variante: 'normal' },
  atencao: { rotulo: 'Atenção', variante: 'atencao' },
  critico: { rotulo: 'Crítico', variante: 'critico' },
}

/** Situação exibida da reserva: as ativas são classificadas pelo tempo restante. */
export function situacaoReserva(r: Pick<Reserva, 'status' | 'expiraEm'>, agora: number): { rotulo: string; variante: VarianteBadge } {
  if (r.status === 'convertida') return { rotulo: 'Vendida', variante: 'laranja' }
  if (r.status === 'cancelada') return { rotulo: 'Cancelada', variante: 'neutro' }
  const restante = new Date(r.expiraEm).getTime() - agora
  if (restante <= 0) return { rotulo: 'Expirada', variante: 'neutro' }
  return SITUACAO_RESERVA_ATIVA[urgenciaReserva(restante)]
}
