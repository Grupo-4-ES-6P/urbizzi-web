import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Layout } from '../../../components/layout/Layout';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Field, FieldGrid, SelectInput, TextInput } from '../../../components/ui/Field';
import { FormSection } from '../../../components/ui/FormSection';
import { formatCpfCnpj } from '../../../utils/cpfCnpj';
import { SITUACAO_IMOVEL_LABEL } from '../../imoveis/types';
import { criarReserva, ReservaError } from '../api/reservasApi';
import { useOpcoesNovaReserva } from '../hooks/useOpcoesNovaReserva';
import { formatarMoeda, parseMoeda, rotuloQuadraLote } from '../utils/formatacao';
import {
  bloqueioDoImovel,
  formularioAlterado,
  paraNovaReservaInput,
  parseValidade,
  validarNovaReserva,
  valoresIniciais,
  type NovaReservaFormValues,
} from '../utils/novaReservaForm';
import { calcularDataExpiracao, formatarData, hojeCalendario, isDataCalendarioValida } from '../utils/prazo';
import styles from './ReservaPage.module.css';

const OPCOES_AVISO = [24, 48, 72];

export function NovaReserva() {
  const navigate = useNavigate();
  const opcoes = useOpcoesNovaReserva();
  const [iniciais] = useState<NovaReservaFormValues>(() => valoresIniciais(hojeCalendario(new Date())));
  const [values, setValues] = useState<NovaReservaFormValues>(iniciais);
  const [tentouEnviar, setTentouEnviar] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [erroServidor, setErroServidor] = useState<string | null>(null);
  const [confirmandoCancelamento, setConfirmandoCancelamento] = useState(false);

  const imovel = opcoes?.imoveis.find((item) => String(item.id) === values.imovel_id);
  const situacaoImovel = imovel ? opcoes?.situacoes[imovel.id] : undefined;
  const loteamento = opcoes?.loteamentos.find((item) => String(item.id) === values.loteamento_id);
  const imoveisDoLoteamento = opcoes?.imoveis.filter((item) => String(item.loteamento_id) === values.loteamento_id) ?? [];
  const cliente = opcoes?.clientes.find((item) => String(item.id_cliente) === values.cliente_id);

  const validade = parseValidade(values.validade_dias);
  const dataExpiracao =
    validade !== null && isDataCalendarioValida(values.data_inicio)
      ? calcularDataExpiracao(values.data_inicio, validade)
      : null;

  const errors = validarNovaReserva(values, situacaoImovel);
  const bloqueio = bloqueioDoImovel(situacaoImovel);

  /** Erros aparecem após a primeira tentativa de envio; o bloqueio do imóvel (RF13/RF14) aparece de imediato. */
  function erro(campo: keyof NovaReservaFormValues): string | undefined {
    if (campo === 'imovel_id' && bloqueio) return bloqueio;
    return tentouEnviar ? errors[campo] : undefined;
  }

  function invalido(campo: keyof NovaReservaFormValues) {
    const mensagem = erro(campo);
    return mensagem ? { 'aria-invalid': true, 'aria-describedby': `${campo}-erro` } : {};
  }

  function setField<K extends keyof NovaReservaFormValues>(campo: K, valor: NovaReservaFormValues[K]) {
    setValues((prev) => ({ ...prev, [campo]: valor }));
  }

  function handleCancelar() {
    if (formularioAlterado(values, iniciais)) {
      setConfirmandoCancelamento(true);
      return;
    }
    navigate('/reservas');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTentouEnviar(true);
    setErroServidor(null);

    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    try {
      const reserva = await criarReserva(paraNovaReservaInput(values));
      navigate(`/reservas/${reserva.id}`);
    } catch (error) {
      setErroServidor(error instanceof ReservaError ? error.message : 'Não foi possível criar a reserva.');
      setIsSubmitting(false);
    }
  }

  return (
    <Layout>
      <PageHeader
        breadcrumb="Reservas › Nova reserva"
        title="Nova reserva"
        description="Bloqueia o imóvel por um prazo determinado · RF13, RF14 e RF15"
      />

      <form className={styles.stack} onSubmit={handleSubmit} noValidate>
        {erroServidor && (
          <p className={styles.formError} role="alert">
            {erroServidor}
          </p>
        )}

        <FormSection
          title="Imóvel"
          description="Somente imóveis com situação Disponível podem ser reservados."
          note="RF14 — o sistema impede a criação se já existir uma reserva ativa para este imóvel."
        >
          <FieldGrid columns="1.75fr 1.5fr 1fr 2.5fr">
            <Field id="loteamento_id" label="Loteamento" error={erro('loteamento_id')}>
              <SelectInput
                id="loteamento_id"
                value={values.loteamento_id}
                onChange={(event) => setValues((prev) => ({ ...prev, loteamento_id: event.target.value, imovel_id: '' }))}
                {...invalido('loteamento_id')}
              >
                <option value="">Selecione</option>
                {opcoes?.loteamentos.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome}
                  </option>
                ))}
              </SelectInput>
            </Field>

            <Field id="imovel_id" label="Quadra / Lote" error={erro('imovel_id')}>
              <SelectInput
                id="imovel_id"
                value={values.imovel_id}
                disabled={!values.loteamento_id}
                onChange={(event) => setField('imovel_id', event.target.value)}
                {...invalido('imovel_id')}
              >
                <option value="">Selecione</option>
                {imoveisDoLoteamento.map((item) => {
                  const situacao = opcoes?.situacoes[item.id];
                  return (
                    <option key={item.id} value={item.id}>
                      {rotuloQuadraLote(item)}
                      {situacao && situacao !== 'disponivel' ? ` (${SITUACAO_IMOVEL_LABEL[situacao]})` : ''}
                    </option>
                  );
                })}
              </SelectInput>
            </Field>

            <Field id="matricula" label="Matrícula">
              <TextInput id="matricula" readOnly value={imovel?.matricula ?? ''} placeholder="—" />
            </Field>

            <Field id="situacao_imovel" label="Situação atual">
              <TextInput
                id="situacao_imovel"
                readOnly
                value={situacaoImovel ? SITUACAO_IMOVEL_LABEL[situacaoImovel] : ''}
                placeholder="—"
              />
            </Field>
          </FieldGrid>
        </FormSection>

        <FormSection title="Cliente e responsável" description="A reserva precisa estar vinculada a um cliente cadastrado.">
          <FieldGrid columns="3fr 1fr 1fr">
            <Field
              id="cliente_id"
              label="Cliente"
              error={erro('cliente_id')}
            >
              <SelectInput
                id="cliente_id"
                value={values.cliente_id}
                onChange={(event) => setField('cliente_id', event.target.value)}
                {...invalido('cliente_id')}
              >
                <option value="">Selecione</option>
                {opcoes?.clientes.map((item) => (
                  <option key={item.id_cliente} value={item.id_cliente}>
                    {item.nome_completo}
                  </option>
                ))}
              </SelectInput>
            </Field>

            <Field id="cliente_cpf_cnpj" label="CPF / CNPJ">
              <TextInput
                id="cliente_cpf_cnpj"
                readOnly
                value={cliente?.cpf_cnpj ? formatCpfCnpj(cliente.cpf_cnpj, cliente.tipo_pessoa) : ''}
                placeholder="—"
              />
            </Field>

            <Field id="cliente_telefone" label="Telefone">
              <TextInput id="cliente_telefone" readOnly value={cliente?.telefone ?? ''} placeholder="—" />
            </Field>
          </FieldGrid>

          {opcoes && opcoes.clientes.length === 0 && (
            <p className={styles.inlineHint}>
              Nenhum cliente ativo cadastrado. <Link to="/clientes/novo">Cadastrar cliente</Link>
            </p>
          )}

          <FieldGrid columns="1.15fr 1fr 2.1fr">
            <Field id="responsavel_id" label="Responsável comercial" error={erro('responsavel_id')}>
              <SelectInput
                id="responsavel_id"
                value={values.responsavel_id}
                onChange={(event) => setField('responsavel_id', event.target.value)}
                {...invalido('responsavel_id')}
              >
                <option value="">Selecione</option>
                {opcoes?.corretores.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome}
                  </option>
                ))}
              </SelectInput>
            </Field>

            <Field id="origem_interesse" label="Origem do interesse">
              <TextInput
                id="origem_interesse"
                value={values.origem_interesse}
                onChange={(event) => setField('origem_interesse', event.target.value)}
                placeholder="Ex.: Catálogo público"
              />
            </Field>

            <Field id="contato_recente" label="Contato mais recente">
              <TextInput
                id="contato_recente"
                value={values.contato_recente}
                onChange={(event) => setField('contato_recente', event.target.value)}
                placeholder="Ex.: 22/08/2026 · WhatsApp"
              />
            </Field>
          </FieldGrid>
        </FormSection>

        <FormSection
          title="Prazo da reserva"
          description="Validade em dias corridos a partir da data inicial."
          note="RF16 — ao chegar na data de expiração sem renovação, a reserva expira sozinha e o imóvel volta para Disponível."
        >
          <FieldGrid columns="1.1fr 1fr 1.1fr 1.1fr 1.6fr">
            <Field id="data_inicio" label="Data inicial" error={erro('data_inicio')}>
              <TextInput
                id="data_inicio"
                type="date"
                value={values.data_inicio}
                onChange={(event) => setField('data_inicio', event.target.value)}
                {...invalido('data_inicio')}
              />
            </Field>

            <Field id="validade_dias" label="Validade (dias)" error={erro('validade_dias')}>
              <TextInput
                id="validade_dias"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={values.validade_dias}
                onChange={(event) => setField('validade_dias', event.target.value)}
                {...invalido('validade_dias')}
              />
            </Field>

            <Field id="data_expiracao" label="Expira em">
              <TextInput
                id="data_expiracao"
                readOnly
                value={dataExpiracao ? formatarData(dataExpiracao) : ''}
                placeholder="—"
              />
            </Field>

            <Field id="renovacoes_permitidas" label="Renovações permitidas">
              <TextInput
                id="renovacoes_permitidas"
                readOnly
                value={loteamento ? String(loteamento.limite_renovacoes) : ''}
                placeholder="—"
              />
            </Field>

            <Field id="avisar_horas_antes" label="Avisar responsável em">
              <SelectInput
                id="avisar_horas_antes"
                value={values.avisar_horas_antes}
                onChange={(event) => setField('avisar_horas_antes', event.target.value)}
              >
                {OPCOES_AVISO.map((horas) => (
                  <option key={horas} value={horas}>
                    {horas}h antes
                  </option>
                ))}
              </SelectInput>
            </Field>
          </FieldGrid>
        </FormSection>

        <FormSection
          title="Condições e observações"
          description="Informações que alimentam a proposta comercial gerada a partir desta reserva."
        >
          <FieldGrid columns="1.1fr 1fr 1.2fr 0.9fr 1.25fr">
            <Field id="valor_tabela" label="Valor de tabela">
              <TextInput id="valor_tabela" readOnly value={imovel ? formatarMoeda(imovel.valor_tabela) : ''} placeholder="—" />
            </Field>

            <Field id="sinal" label="Sinal acordado">
              <TextInput
                id="sinal"
                inputMode="numeric"
                value={values.sinal}
                onChange={(event) => setField('sinal', formatarMoeda(parseMoeda(event.target.value)))}
                placeholder="R$ 0"
              />
            </Field>

            <Field id="forma_pagamento" label="Forma de pagamento">
              <TextInput
                id="forma_pagamento"
                value={values.forma_pagamento}
                onChange={(event) => setField('forma_pagamento', event.target.value)}
                placeholder="Ex.: Entrada + 24x"
              />
            </Field>

            <Field id="desconto_percentual" label="Desconto pretendido" error={erro('desconto_percentual')}>
              <TextInput
                id="desconto_percentual"
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                step={0.5}
                value={values.desconto_percentual}
                onChange={(event) => setField('desconto_percentual', event.target.value)}
                placeholder="0 %"
                {...invalido('desconto_percentual')}
              />
            </Field>
          </FieldGrid>

          <FieldGrid columns="1fr">
            <Field id="observacoes" label="Observações">
              <TextInput
                id="observacoes"
                value={values.observacoes}
                onChange={(event) => setField('observacoes', event.target.value)}
                placeholder="Ex.: Cliente pediu simulação em 120x."
              />
            </Field>
          </FieldGrid>
        </FormSection>

        <div className={styles.footer}>
          <Button variant="outline" type="button" onClick={handleCancelar}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting || opcoes === null}>
            {isSubmitting ? 'Criando...' : 'Criar reserva'}
          </Button>
        </div>
      </form>

      {confirmandoCancelamento && (
        <ConfirmDialog
          message="Existem campos preenchidos. Tem certeza que quer cancelar? Os dados informados serão perdidos."
          confirmLabel="Descartar"
          cancelLabel="Continuar editando"
          onConfirm={() => navigate('/reservas')}
          onCancel={() => setConfirmandoCancelamento(false)}
        />
      )}
    </Layout>
  );
}
