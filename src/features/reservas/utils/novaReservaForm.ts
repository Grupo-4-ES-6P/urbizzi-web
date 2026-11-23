import type { SituacaoImovel } from '../../imoveis/types';
import type { NovaReservaInput } from '../types';
import { parseMoeda } from './formatacao';
import { isDataCalendarioValida } from './prazo';

export interface NovaReservaFormValues {
  loteamento_id: string;
  imovel_id: string;
  cliente_id: string;
  responsavel_id: string;
  origem_interesse: string;
  contato_recente: string;
  data_inicio: string;
  validade_dias: string;
  avisar_horas_antes: string;
  sinal: string;
  forma_pagamento: string;
  desconto_percentual: string;
  observacoes: string;
}

export type NovaReservaFormErrors = Partial<Record<keyof NovaReservaFormValues, string>>;

export const VALIDADE_MAXIMA_DIAS = 365;

export function valoresIniciais(hoje: string): NovaReservaFormValues {
  return {
    loteamento_id: '',
    imovel_id: '',
    cliente_id: '',
    responsavel_id: '',
    origem_interesse: '',
    contato_recente: '',
    data_inicio: hoje,
    validade_dias: '15',
    avisar_horas_antes: '48',
    sinal: '',
    forma_pagamento: '',
    desconto_percentual: '',
    observacoes: '',
  };
}

/** Indica se o usuário preencheu ou alterou algum campo em relação aos valores iniciais. */
export function formularioAlterado(values: NovaReservaFormValues, iniciais: NovaReservaFormValues): boolean {
  return (Object.keys(iniciais) as (keyof NovaReservaFormValues)[]).some((campo) => values[campo] !== iniciais[campo]);
}

export function parseValidade(valor: string): number | null {
  if (!/^\d+$/.test(valor.trim())) return null;
  const dias = Number(valor);
  return dias >= 1 && dias <= VALIDADE_MAXIMA_DIAS ? dias : null;
}

/** Mensagem de bloqueio do imóvel selecionado (RF13/RF14), ou undefined se puder ser reservado. */
export function bloqueioDoImovel(situacao: SituacaoImovel | undefined): string | undefined {
  if (situacao === 'reservado') return 'Já existe uma reserva ativa para este imóvel.';
  if (situacao === 'vendido') return 'Somente imóveis com situação Disponível podem ser reservados.';
  return undefined;
}

export function validarNovaReserva(
  values: NovaReservaFormValues,
  situacaoImovel: SituacaoImovel | undefined,
): NovaReservaFormErrors {
  const errors: NovaReservaFormErrors = {};

  if (!values.loteamento_id) errors.loteamento_id = 'Selecione o loteamento.';
  if (!values.imovel_id) errors.imovel_id = 'Selecione a quadra e o lote.';
  else {
    const bloqueio = bloqueioDoImovel(situacaoImovel);
    if (bloqueio) errors.imovel_id = bloqueio;
  }
  if (!values.cliente_id) errors.cliente_id = 'Selecione um cliente cadastrado.';
  if (!values.responsavel_id) errors.responsavel_id = 'Selecione o responsável comercial.';
  if (!isDataCalendarioValida(values.data_inicio)) errors.data_inicio = 'Informe uma data válida.';
  if (parseValidade(values.validade_dias) === null) {
    errors.validade_dias = `Informe um número inteiro de 1 a ${VALIDADE_MAXIMA_DIAS}.`;
  }

  const desconto = values.desconto_percentual.trim();
  if (desconto && (Number.isNaN(Number(desconto)) || Number(desconto) < 0 || Number(desconto) > 100)) {
    errors.desconto_percentual = 'Informe um percentual entre 0 e 100.';
  }

  return errors;
}

/** Converte o formulário já validado para o payload da API. */
export function paraNovaReservaInput(values: NovaReservaFormValues): NovaReservaInput {
  const desconto = values.desconto_percentual.trim();
  return {
    imovel_id: Number(values.imovel_id),
    cliente_id: Number(values.cliente_id),
    responsavel_id: Number(values.responsavel_id),
    origem_interesse: values.origem_interesse,
    contato_recente: values.contato_recente,
    data_inicio: values.data_inicio,
    validade_dias: Number(values.validade_dias),
    avisar_horas_antes: Number(values.avisar_horas_antes),
    sinal: parseMoeda(values.sinal),
    forma_pagamento: values.forma_pagamento,
    desconto_percentual: desconto ? Number(desconto) : null,
    observacoes: values.observacoes,
  };
}
