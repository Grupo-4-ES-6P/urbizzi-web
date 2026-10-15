import tableStyles from '../../../components/ui/DataTable.module.css';
import { FormSection } from '../../../components/ui/FormSection';
import type { EventoReserva } from '../types';
import { formatarData } from '../utils/prazo';
import { ReservaStatusBadge } from './ReservaStatusBadge';

export function HistoricoReserva({ eventos }: { eventos: EventoReserva[] }) {
  const ordenados = [...eventos].sort((a, b) => a.data.localeCompare(b.data));

  return (
    <FormSection title="Histórico da reserva" description="Toda alteração fica registrada para auditoria · RF32." flush>
      <div className={tableStyles.flush}>
        <table className={tableStyles.table}>
          <thead>
            <tr>
              <th scope="col">Data</th>
              <th scope="col">Evento</th>
              <th scope="col">Responsável</th>
              <th scope="col">Detalhe</th>
              <th scope="col">Situação</th>
            </tr>
          </thead>
          <tbody>
            {ordenados.map((evento) => (
              <tr key={evento.id}>
                <td className={tableStyles.strong}>{formatarData(evento.data)}</td>
                <td>{evento.evento}</td>
                <td>{evento.responsavel}</td>
                <td>{evento.detalhe}</td>
                <td>
                  <ReservaStatusBadge situacao={evento.situacao} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </FormSection>
  );
}
