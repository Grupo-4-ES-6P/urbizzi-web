import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../../../components/layout/Layout';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Field, FieldGrid, SelectInput, TextInput } from '../../../components/ui/Field';
import { FormSection } from '../../../components/ui/FormSection';
import { ReadonlyValue } from '../../../components/ui/ReadonlyValue';
import { cancelarReserva, renovarReserva, ReservaError } from '../api/reservasApi';
import { HistoricoReserva } from '../components/HistoricoReserva';
import { useReserva } from '../hooks/useReservas';
import { parseValidade, VALIDADE_MAXIMA_DIAS } from '../utils/novaReservaForm';
import {
  adicionarDias,
  correspondeAoFiltro,
  formatarData,
  formatarTempoRestante,
  STATUS_RESERVA_LABEL,
} from '../utils/prazo';
import styles from './ReservaPage.module.css';

const RENOVAR_FORM_ID = 'renovar-reserva-form';
const CANCELAR_FORM_ID = 'cancelar-reserva-form';

const MOTIVOS_CANCELAMENTO = [
  'Desistência do cliente',
  'Crédito não aprovado',
  'Troca de imóvel',
  'Erro de cadastro',
  'Outro',
];

function mensagemDeErro(error: unknown, padrao: string): string {
  return error instanceof ReservaError ? error.message : padrao;
}

export function DetalheReserva() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { view, isLoading, recarregar } = useReserva(id);

  const [diasRenovacao, setDiasRenovacao] = useState('15');
  const [justificativa, setJustificativa] = useState('');
  const [tentouRenovar, setTentouRenovar] = useState(false);

  const [motivo, setMotivo] = useState('');
  const [detalhamento, setDetalhamento] = useState('');
  const [tentouCancelar, setTentouCancelar] = useState(false);
  const [confirmandoCancelamento, setConfirmandoCancelamento] = useState(false);

  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!view) {
    return (
      <Layout>
        <PageHeader breadcrumb={`Reservas › ${id}`} title={`Reserva ${id}`} />
        <p className={styles.empty}>
          {isLoading ? 'Carregando reserva…' : 'Reserva não encontrada.'}{' '}
          {!isLoading && <Link to="/reservas">Voltar para Reservas</Link>}
        </p>
      </Layout>
    );
  }

  const { reserva } = view;
  const ativa = correspondeAoFiltro(view.situacao, 'ativas');
  const limiteAtingido = reserva.renovacoes_usadas >= reserva.renovacoes_permitidas;

  const dias = parseValidade(diasRenovacao);
  const novaExpiracao = dias !== null ? adicionarDias(reserva.data_expiracao, dias) : null;
  const erroDias = tentouRenovar && dias === null ? `Informe um número inteiro de 1 a ${VALIDADE_MAXIMA_DIAS}.` : undefined;
  const erroJustificativa = tentouRenovar && !justificativa.trim() ? 'Informe a justificativa da renovação.' : undefined;
  const erroMotivo = tentouCancelar && !motivo ? 'Selecione o motivo do cancelamento.' : undefined;

  async function handleRenovar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTentouRenovar(true);
    setErro(null);
    setFeedback(null);
    if (dias === null || !justificativa.trim()) return;

    setProcessando(true);
    try {
      await renovarReserva(reserva.id, { dias, justificativa });
      setJustificativa('');
      setTentouRenovar(false);
      setFeedback('Reserva renovada com sucesso.');
      await recarregar();
    } catch (error) {
      setErro(mensagemDeErro(error, 'Não foi possível renovar a reserva.'));
    } finally {
      setProcessando(false);
    }
  }

  function handleSolicitarCancelamento(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTentouCancelar(true);
    setErro(null);
    setFeedback(null);
    if (!motivo) return;
    setConfirmandoCancelamento(true);
  }

  async function handleConfirmarCancelamento() {
    setConfirmandoCancelamento(false);
    setProcessando(true);
    try {
      await cancelarReserva(reserva.id, { motivo, detalhamento });
      setFeedback('Reserva cancelada. O imóvel voltou para Disponível.');
      await recarregar();
    } catch (error) {
      setErro(mensagemDeErro(error, 'Não foi possível cancelar a reserva.'));
    } finally {
      setProcessando(false);
    }
  }

  return (
    <Layout>
      <PageHeader
        breadcrumb={`Reservas › ${reserva.id}`}
        title={`Reserva ${reserva.id}`}
        description={`${view.imovelLabel} · ${view.clienteNome}`}
        actions={
          ativa ? (
            <>
              <Button variant="outline" type="submit" form={CANCELAR_FORM_ID} disabled={processando}>
                Cancelar reserva
              </Button>
              <Button type="submit" form={RENOVAR_FORM_ID} disabled={processando || limiteAtingido}>
                Renovar reserva
              </Button>
            </>
          ) : (
            <Button variant="outline" type="button" onClick={() => navigate('/reservas')}>
              Voltar
            </Button>
          )
        }
      />

      <div className={styles.stack}>
        {erro && (
          <p className={styles.formError} role="alert">
            {erro}
          </p>
        )}
        {feedback && (
          <p className={styles.inlineHint} role="status">
            {feedback}
          </p>
        )}

        <FormSection
          title="Situação atual"
          description={
            ativa
              ? 'Enquanto esta reserva estiver ativa, nenhuma outra pode ser criada para o mesmo imóvel.'
              : 'Esta reserva não está mais ativa; o imóvel pode receber uma nova reserva.'
          }
        >
          <FieldGrid as="dl" columns="repeat(6, minmax(0, 1fr))">
            <ReadonlyValue label="Status">{STATUS_RESERVA_LABEL[view.situacao]}</ReadonlyValue>
            <ReadonlyValue label="Criada em">{formatarData(reserva.data_inicio)}</ReadonlyValue>
            <ReadonlyValue label="Expira em">{formatarData(reserva.data_expiracao)}</ReadonlyValue>
            <ReadonlyValue label="Tempo restante" tone={view.situacao === 'critico' ? 'danger' : 'default'}>
              {ativa ? formatarTempoRestante(view.msRestantes) : '—'}
            </ReadonlyValue>
            <ReadonlyValue label="Renovações usadas">
              {reserva.renovacoes_usadas} de {reserva.renovacoes_permitidas}
            </ReadonlyValue>
            <ReadonlyValue label="Responsável">{view.responsavelNome}</ReadonlyValue>
          </FieldGrid>
        </FormSection>

        {ativa && (
          <form id={RENOVAR_FORM_ID} onSubmit={handleRenovar} noValidate>
            <FormSection
              title="Renovar reserva"
              description="A renovação estende a validade sem liberar o imóvel."
              note={
                limiteAtingido
                  ? 'Limite de renovações do loteamento atingido. RF15 — cada renovação fica registrada com autor, data e justificativa.'
                  : 'RF15 — cada renovação fica registrada com autor, data e justificativa, e respeita o limite de renovações do loteamento.'
              }
            >
              <FieldGrid columns="1fr 1.1fr 2.9fr">
                <Field id="renovacao_dias" label="Nova validade (dias)" error={erroDias}>
                  <TextInput
                    id="renovacao_dias"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    value={diasRenovacao}
                    disabled={limiteAtingido}
                    onChange={(event) => setDiasRenovacao(event.target.value)}
                    aria-invalid={erroDias ? true : undefined}
                    aria-describedby={erroDias ? 'renovacao_dias-erro' : undefined}
                  />
                </Field>
                <Field id="renovacao_expiracao" label="Nova data de expiração">
                  <TextInput
                    id="renovacao_expiracao"
                    readOnly
                    value={novaExpiracao ? formatarData(novaExpiracao) : ''}
                    placeholder="—"
                  />
                </Field>
                <Field id="renovacao_justificativa" label="Justificativa" error={erroJustificativa}>
                  <TextInput
                    id="renovacao_justificativa"
                    value={justificativa}
                    disabled={limiteAtingido}
                    onChange={(event) => setJustificativa(event.target.value)}
                    placeholder="Ex.: Cliente aguardando aprovação de crédito no banco."
                    aria-invalid={erroJustificativa ? true : undefined}
                    aria-describedby={erroJustificativa ? 'renovacao_justificativa-erro' : undefined}
                  />
                </Field>
              </FieldGrid>
            </FormSection>
          </form>
        )}

        {ativa && (
          <form id={CANCELAR_FORM_ID} onSubmit={handleSolicitarCancelamento} noValidate>
            <FormSection
              title="Cancelar reserva"
              description="O cancelamento libera o imóvel imediatamente e mantém o histórico."
              note="Ao confirmar, o imóvel volta para Disponível e reaparece no catálogo público."
            >
              <FieldGrid columns="1.5fr 3fr 1fr">
                <Field id="cancelamento_motivo" label="Motivo do cancelamento" error={erroMotivo}>
                  <SelectInput
                    id="cancelamento_motivo"
                    value={motivo}
                    onChange={(event) => setMotivo(event.target.value)}
                    aria-invalid={erroMotivo ? true : undefined}
                    aria-describedby={erroMotivo ? 'cancelamento_motivo-erro' : undefined}
                  >
                    <option value="">Selecione</option>
                    {MOTIVOS_CANCELAMENTO.map((opcao) => (
                      <option key={opcao} value={opcao}>
                        {opcao}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
                <Field id="cancelamento_detalhamento" label="Detalhamento">
                  <TextInput
                    id="cancelamento_detalhamento"
                    value={detalhamento}
                    onChange={(event) => setDetalhamento(event.target.value)}
                    placeholder="Ex.: Crédito negado pelo banco; cliente pediu para liberar o lote."
                  />
                </Field>
                <Field id="cancelamento_liberar" label="Liberar imóvel agora">
                  <TextInput id="cancelamento_liberar" readOnly value="Sim" />
                </Field>
              </FieldGrid>
            </FormSection>
          </form>
        )}

        <HistoricoReserva eventos={reserva.historico} />
      </div>

      {confirmandoCancelamento && (
        <ConfirmDialog
          message={`Cancelar a reserva ${reserva.id}? O imóvel volta imediatamente para Disponível.`}
          confirmLabel="Cancelar reserva"
          cancelLabel="Voltar"
          onConfirm={handleConfirmarCancelamento}
          onCancel={() => setConfirmandoCancelamento(false)}
        />
      )}
    </Layout>
  );
}
