import { Link } from 'react-router-dom';
import tableStyles from '../../../components/ui/DataTable.module.css';
import type { ReservaView } from '../hooks/useReservas';
import { abreviarNome } from '../utils/formatacao';
import { formatarData, formatarTempoRestante } from '../utils/prazo';
import { ReservaStatusBadge } from './ReservaStatusBadge';

interface ReservasTableProps {
  reservas: ReservaView[];
  mensagemVazia: string;
}

function ExpiraEm({ view }: { view: ReservaView }) {
  switch (view.situacao) {
    case 'expirada':
      return <span className={tableStyles.strong}>Expirada</span>;
    case 'cancelada':
      return <span className={tableStyles.strong}>Cancelada</span>;
    case 'convertida':
      return <span className={tableStyles.strong}>Convertida</span>;
    case 'critico':
      return <span className={tableStyles.danger}>{formatarTempoRestante(view.msRestantes)}</span>;
    default:
      return <span className={tableStyles.strong}>{formatarTempoRestante(view.msRestantes)}</span>;
  }
}

export function ReservasTable({ reservas, mensagemVazia }: ReservasTableProps) {
  return (
    <div className={tableStyles.wrapper}>
      <table className={tableStyles.table}>
        <thead>
          <tr>
            <th scope="col">Imóvel</th>
            <th scope="col">Cliente</th>
            <th scope="col">Corretor</th>
            <th scope="col">Criada em</th>
            <th scope="col">Expira em</th>
            <th scope="col">Status</th>
            <th scope="col">
              <span className="sr-only">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {reservas.length === 0 ? (
            <tr>
              <td colSpan={7} className={tableStyles.empty}>
                {mensagemVazia}
              </td>
            </tr>
          ) : (
            reservas.map((view) => (
              <tr key={view.reserva.id}>
                <td className={tableStyles.strong}>{view.imovelLabel}</td>
                <td>{view.clienteNome}</td>
                <td>{abreviarNome(view.responsavelNome)}</td>
                <td>{formatarData(view.reserva.data_inicio)}</td>
                <td>
                  <ExpiraEm view={view} />
                </td>
                <td>
                  <ReservaStatusBadge situacao={view.situacao} />
                </td>
                <td>
                  <Link
                    to={`/reservas/${view.reserva.id}`}
                    className={tableStyles.rowAction}
                    aria-label={`Detalhes da reserva ${view.reserva.id}`}
                  >
                    Detalhes
                  </Link>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
