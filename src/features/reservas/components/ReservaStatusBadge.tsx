import { Badge, type BadgeTone } from '../../../components/ui/Badge';
import type { SituacaoHistorico } from '../types';

const CONFIG: Record<SituacaoHistorico, { label: string; tone: BadgeTone }> = {
  ativa: { label: 'Ativa', tone: 'success' },
  atencao: { label: 'Atenção', tone: 'warning' },
  critico: { label: 'Crítico', tone: 'danger' },
  expirada: { label: 'Expirada', tone: 'neutral' },
  cancelada: { label: 'Cancelada', tone: 'neutral' },
  convertida: { label: 'Vendida', tone: 'accent' },
  em_analise: { label: 'Em análise', tone: 'dark' },
};

export function ReservaStatusBadge({ situacao }: { situacao: SituacaoHistorico }) {
  const { label, tone } = CONFIG[situacao];
  return <Badge tone={tone}>{label}</Badge>;
}
