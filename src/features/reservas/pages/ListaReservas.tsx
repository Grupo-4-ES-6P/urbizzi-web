import { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../../../components/layout/Layout';
import { PageHeader } from '../../../components/layout/PageHeader';
import { AlertBanner } from '../../../components/ui/AlertBanner';
import { Button } from '../../../components/ui/Button';
import { FilterTabs, type FilterTab } from '../../../components/ui/FilterTabs';
import { ReservasTable } from '../components/ReservasTable';
import { useReservas, type ReservaView } from '../hooks/useReservas';
import type { FiltroReservas, SituacaoReserva } from '../types';
import { abreviarNome } from '../utils/formatacao';
import { baixarCsv, gerarCsv } from '../utils/exportarCsv';
import { correspondeAoFiltro, formatarData, formatarTempoRestante } from '../utils/prazo';
import styles from './ListaReservas.module.css';

const FILTROS: { value: FiltroReservas; label: string }[] = [
  { value: 'todas', label: 'Todas' },
  { value: 'ativas', label: 'Ativas' },
  { value: 'a_vencer', label: 'A vencer' },
  { value: 'expiradas', label: 'Expiradas' },
  { value: 'convertidas', label: 'Convertidas' },
];

const ORDEM_SITUACAO: Record<SituacaoReserva, number> = {
  critico: 0,
  atencao: 0,
  ativa: 0,
  expirada: 1,
  cancelada: 2,
  convertida: 3,
};

const STATUS_CSV: Record<SituacaoReserva, string> = {
  ativa: 'Ativa',
  atencao: 'Atenção',
  critico: 'Crítico',
  expirada: 'Expirada',
  cancelada: 'Cancelada',
  convertida: 'Vendida',
};

/** Minúsculas e sem acentos, para a busca ignorar caixa e acentuação. */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function correspondeABusca(view: ReservaView, termo: string): boolean {
  if (!termo) return true;
  return [view.responsavelNome, view.imovelLabel, view.clienteNome].some((campo) => normalizar(campo).includes(termo));
}

/** Ativas primeiro (as que vencem antes no topo); demais pelas mais recentes. */
function ordenar(a: ReservaView, b: ReservaView): number {
  const porSituacao = ORDEM_SITUACAO[a.situacao] - ORDEM_SITUACAO[b.situacao];
  if (porSituacao !== 0) return porSituacao;
  if (ORDEM_SITUACAO[a.situacao] === 0) return a.msRestantes - b.msRestantes;
  return b.reserva.data_expiracao.localeCompare(a.reserva.data_expiracao);
}

export function ListaReservas() {
  const navigate = useNavigate();
  const { views, isLoading } = useReservas();
  const [filtro, setFiltro] = useState<FiltroReservas>('todas');
  const [busca, setBusca] = useState('');

  const termo = normalizar(busca.trim());
  const ordenadas = useMemo(() => [...views].sort(ordenar), [views]);
  const buscadas = ordenadas.filter((view) => correspondeABusca(view, termo));

  const tabs: FilterTab<FiltroReservas>[] = FILTROS.map((item) => ({
    ...item,
    count: buscadas.filter((view) => correspondeAoFiltro(view.situacao, item.value)).length,
  }));

  const filtradas = buscadas.filter((view) => correspondeAoFiltro(view.situacao, filtro));
  // O alerta considera todas as reservas, independente da busca.
  const quantidadeAVencer = views.filter((view) => correspondeAoFiltro(view.situacao, 'a_vencer')).length;

  function exportar() {
    const csv = gerarCsv(
      ['Reserva', 'Imóvel', 'Cliente', 'Corretor', 'Criada em', 'Expira em', 'Tempo restante', 'Status'],
      filtradas.map((view) => [
        view.reserva.id,
        view.imovelLabel,
        view.clienteNome,
        abreviarNome(view.responsavelNome),
        formatarData(view.reserva.data_inicio),
        formatarData(view.reserva.data_expiracao),
        correspondeAoFiltro(view.situacao, 'ativas') ? formatarTempoRestante(view.msRestantes) : '',
        STATUS_CSV[view.situacao],
      ]),
    );
    baixarCsv('reservas.csv', csv);
  }

  return (
    <Layout>
      <PageHeader
        breadcrumb="Reservas"
        title="Reservas"
        description="Reservas expiram automaticamente ao fim do prazo do empreendimento"
        actions={
          <>
            <Button variant="outline" type="button" onClick={exportar} disabled={filtradas.length === 0}>
              Exportar CSV
            </Button>
            <Button type="button" onClick={() => navigate('/reservas/nova')}>
              <Plus size={16} aria-hidden="true" className={styles.buttonIcon} />
              Nova reserva
            </Button>
          </>
        }
      />

      <div className={styles.stack}>
        {quantidadeAVencer > 0 && (
          <AlertBanner
            title={
              quantidadeAVencer === 1
                ? '1 reserva vence nas próximas 48 horas'
                : `${quantidadeAVencer} reservas vencem nas próximas 48 horas`
            }
            description="Sem proposta registrada, o imóvel volta ao catálogo automaticamente."
            action={
              <Button type="button" className={styles.bannerButton} onClick={() => setFiltro('a_vencer')}>
                Ver reservas críticas
              </Button>
            }
          />
        )}

        <div className={styles.searchWrapper}>
          <Search className={styles.searchIcon} size={18} aria-hidden="true" />
          <input
            type="search"
            className={styles.search}
            placeholder="Buscar por corretor, imóvel ou cliente"
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            aria-label="Buscar reservas"
          />
        </div>

        <FilterTabs label="Filtrar reservas por situação" tabs={tabs} value={filtro} onChange={setFiltro} />

        <ReservasTable
          reservas={filtradas}
          mensagemVazia={
            isLoading
              ? 'Carregando reservas…'
              : views.length === 0
                ? 'Nenhuma reserva cadastrada ainda.'
                : termo
                  ? `Nenhuma reserva encontrada para "${busca.trim()}".`
                  : 'Nenhuma reserva nesta situação.'
          }
        />
      </div>
    </Layout>
  );
}
