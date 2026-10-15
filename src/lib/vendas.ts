import type { Db, StatusVenda, UsuarioPublico, VarianteBadge, Venda } from '../data/types'
import { emAndamento, situacaoProposta } from './propostas'
import { dataCalendario, dataCalendarioValida } from './reservas'

export const STATUS_VENDA: Record<StatusVenda, { rotulo: string; variante: VarianteBadge }> = {
  em_escritura: { rotulo: 'Em escritura', variante: 'escuro' },
  concluida: { rotulo: 'Concluída', variante: 'normal' },
  cancelada: { rotulo: 'Cancelada', variante: 'critico' },
}

export type FiltroVendas = 'todas' | StatusVenda

export const FILTROS_VENDA: { valor: FiltroVendas; rotulo: string }[] = [
  { valor: 'todas', rotulo: 'Todas' },
  { valor: 'em_escritura', rotulo: 'Em escritura' },
  { valor: 'concluida', rotulo: 'Concluídas' },
  { valor: 'cancelada', rotulo: 'Canceladas' },
]

export const vendaAtiva = (v: Pick<Venda, 'status'>) => v.status !== 'cancelada'

// ===== Permissões =====

/** Papéis que podem concluir a escritura e cancelar vendas. */
export const PAPEIS_GESTAO_VENDAS: readonly string[] = ['Administrador', 'Gestor comercial']

export function podeGerirVendas(usuario: Pick<UsuarioPublico, 'papel'> | null | undefined) {
  return !!usuario && PAPEIS_GESTAO_VENDAS.includes(usuario.papel)
}

/** Cancelamento vale a partir de Em escritura e de Concluída; Cancelada é final. */
export const podeCancelar = (v: Pick<Venda, 'status'>) => v.status === 'em_escritura' || v.status === 'concluida'
export const podeConcluir = (v: Pick<Venda, 'status'>) => v.status === 'em_escritura'

export const JUSTIFICATIVA_MINIMA = 10

export function validarJustificativa(texto: string) {
  const tamanho = texto.trim().length
  if (tamanho === 0) return 'Informe a justificativa do cancelamento.'
  if (tamanho < JUSTIFICATIVA_MINIMA) return `A justificativa precisa ter pelo menos ${JUSTIFICATIVA_MINIMA} caracteres.`
  return undefined
}

// ===== Resumo e ordenação =====

const anoDe = (iso: string) => new Date(iso).getFullYear()

/** Soma das vendas não canceladas com data no ano corrente. */
export function valorVendidoNoAno(vendas: Venda[], agora: number) {
  const ano = new Date(agora).getFullYear()
  return vendas.filter((v) => vendaAtiva(v) && anoDe(v.data) === ano).reduce((s, v) => s + v.valor, 0)
}

/**
 * Números do cabeçalho de Vendas. Decisão: "registradas" conta todas as vendas,
 * inclusive as canceladas (ex.: 17 registradas, das quais 2 canceladas), porque
 * uma venda cancelada continua registrada na auditoria.
 */
export function resumoVendas(vendas: Venda[], agora: number) {
  return {
    registradas: vendas.length,
    valorNoAno: valorVendidoNoAno(vendas, agora),
    canceladas: vendas.filter((v) => v.status === 'cancelada').length,
  }
}

/** Mais recentes primeiro; no mesmo instante, o código maior (mais novo) vem antes. */
export function compararPorData(a: Pick<Venda, 'data' | 'codigo'>, b: Pick<Venda, 'data' | 'codigo'>) {
  return b.data.localeCompare(a.data) || b.codigo.localeCompare(a.codigo)
}

// ===== Registro =====

/**
 * Motivo que impede vender o imóvel (para o cliente informado), ou undefined se puder.
 * Usado pelo formulário e pelo serviço, para as duas regras nunca divergirem.
 */
export function impedimentoVenda(db: Db, imovelId: string, clienteId: string, agora: number) {
  const imovel = db.imoveis.find((i) => i.id === imovelId)
  if (!imovel) return 'Imóvel não encontrado.'
  if (db.vendas.some((v) => v.imovelId === imovelId && vendaAtiva(v)) || imovel.situacao === 'vendido') {
    return 'Este imóvel já tem uma venda registrada.'
  }
  if (imovel.status !== 'publicado') return 'Imóveis em rascunho não podem ser vendidos.'
  if (imovel.situacao === 'bloqueado') return 'Imóvel bloqueado não pode ser vendido. Reabilite-o antes.'
  if (!imovel.matricula) return 'Este lote ainda está com a matrícula pendente e não pode ser vendido (RF06).'
  if (db.propostas.some((p) => p.imovelId === imovelId && emAndamento(situacaoProposta(p, agora)))) {
    return 'Há uma proposta em andamento para este imóvel. Conclua a venda pelo fluxo de propostas.'
  }
  const reserva = db.reservas.find(
    (r) => r.imovelId === imovelId && r.status === 'ativa' && new Date(r.expiraEm).getTime() > agora,
  )
  if (reserva && clienteId && reserva.clienteId !== clienteId) return 'Este imóvel está reservado para outro cliente.'
  return undefined
}

export interface FormVenda {
  loteamento: string
  imovelId: string
  clienteId: string
  corretorId: string
  valor: number | null
  /** YYYY-MM-DD */
  data: string
  status: Exclude<StatusVenda, 'cancelada'>
}

export type ErrosVenda = Partial<Record<keyof FormVenda, string>>

export function vendaVazia(hoje: string): FormVenda {
  return { loteamento: '', imovelId: '', clienteId: '', corretorId: '', valor: null, data: hoje, status: 'em_escritura' }
}

export function validarVenda(f: FormVenda, hoje: string, impedimentoImovel?: string): ErrosVenda {
  const e: ErrosVenda = {}
  if (!f.loteamento) e.loteamento = 'Selecione o loteamento.'
  if (!f.imovelId) e.imovelId = 'Selecione a quadra e o lote.'
  else if (impedimentoImovel) e.imovelId = impedimentoImovel
  if (!f.clienteId) e.clienteId = 'Selecione o comprador.'
  if (!f.corretorId) e.corretorId = 'Selecione o corretor.'
  if (f.valor === null || !(f.valor > 0)) e.valor = 'Informe um valor maior que zero.'
  if (!dataCalendarioValida(f.data)) e.data = 'Informe uma data válida.'
  else if (f.data > hoje) e.data = 'A data da venda não pode estar no futuro.'
  return e
}

/** Data de calendário escolhida no formulário → instante gravado (meio-dia local, longe da virada do fuso). */
export function instanteDaVenda(data: string) {
  const [ano, mes, dia] = data.split('-').map(Number)
  return new Date(ano, mes - 1, dia, 12).toISOString()
}

export const hojeCalendario = () => dataCalendario(new Date())
