import type { TomKpi } from '../../components/Kpi'
import type { VarianteBadge } from '../../data/types'

/**
 * Dados da tela de Relatórios. Por enquanto são mocks fixos (valores do protótipo):
 * não há API nem coleção no banco local. Quando houver backend, os indicadores
 * devem ser calculados para o período e a lista deve vir do servidor.
 */

export type FormatoRelatorio = 'PDF' | 'CSV'
export type StatusRelatorio = 'pronto' | 'gerando'

export interface RelatorioGerado {
  id: string
  nome: string
  /** Rótulo livre do período coberto (ex.: "Jul–Ago 2026", "Posição atual"). */
  periodo: string
  formato: FormatoRelatorio
  /** Nome de quem pediu ou "Automático" para relatórios agendados. */
  geradoPor: string
  /** Data de geração, AAAA-MM-DD. */
  geradoEm: string
  status: StatusRelatorio
}

export interface IndicadorRelatorio {
  titulo: string
  valor: string
  detalhe: string
  tom: TomKpi
}

export const STATUS_RELATORIO: Record<StatusRelatorio, { rotulo: string; variante: VarianteBadge }> = {
  pronto: { rotulo: 'Pronto', variante: 'normal' },
  gerando: { rotulo: 'Gerando', variante: 'atencao' },
}

/** Prazo em que os arquivos gerados ficam disponíveis para download. */
export const DIAS_DISPONIVEL = 90

// TODO: calcular a partir das vendas/reservas do período quando houver API e definição do período.
export const INDICADORES_RELATORIO: IndicadorRelatorio[] = [
  { titulo: 'Vendas no período', valor: 'R$ 4,2M', detalhe: '17 contratos fechados', tom: 'destaque' },
  { titulo: 'Ticket médio', valor: 'R$ 247 mil', detalhe: '+9% vs. 2025', tom: 'destaque' },
  { titulo: 'Conversão de reservas', valor: '38%', detalhe: 'reservas que viraram venda', tom: 'destaque' },
  { titulo: 'Tempo médio de venda', valor: '24 dias', detalhe: 'da reserva à escritura', tom: 'destaque' },
]

// TODO: substituir pela listagem real de relatórios gerados quando houver API.
export const RELATORIOS_GERADOS: RelatorioGerado[] = [
  { id: 'rel-1', nome: 'Vendas por empreendimento', periodo: 'Jul–Ago 2026', formato: 'PDF', geradoPor: 'Ayran Bade', geradoEm: '2026-08-24', status: 'pronto' },
  { id: 'rel-2', nome: 'Reservas expiradas', periodo: 'Ago 2026', formato: 'CSV', geradoPor: 'Gabriela Krüger', geradoEm: '2026-08-23', status: 'pronto' },
  { id: 'rel-3', nome: 'Comissões por corretor', periodo: '2º trimestre', formato: 'PDF', geradoPor: 'Arthur Pacheco', geradoEm: '2026-08-20', status: 'pronto' },
  { id: 'rel-4', nome: 'Inventário de imóveis', periodo: 'Posição atual', formato: 'CSV', geradoPor: 'Automático', geradoEm: '2026-08-19', status: 'pronto' },
  { id: 'rel-5', nome: 'Propostas recusadas', periodo: 'Jan–Ago 2026', formato: 'PDF', geradoPor: 'Ayran Bade', geradoEm: '2026-08-18', status: 'gerando' },
  { id: 'rel-6', nome: 'Auditoria de cancelamentos', periodo: '2026', formato: 'PDF', geradoPor: 'Ayran Bade', geradoEm: '2026-08-15', status: 'pronto' },
]
