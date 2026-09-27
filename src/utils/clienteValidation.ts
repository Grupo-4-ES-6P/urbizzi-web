import type { Endereco, TipoPessoa } from '../types/Cliente';
import { isValidCpfCnpj } from './cpfCnpj';

export interface ClienteFormValues {
  nome_completo: string;
  telefone: string;
  email: string;
  ativo: boolean;
  tipo_pessoa: TipoPessoa;
  cpf_cnpj: string;
  data_nascimento: string;
  estado_civil: string;
  profissao: string;
  endereco: Endereco;
}

export interface EnderecoFormErrors {
  cep?: string;
  rua?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  pais?: string;
}

export interface ClienteFormErrors {
  nome_completo?: string;
  telefone?: string;
  email?: string;
  cpf_cnpj?: string;
  data_nascimento?: string;
  endereco?: EnderecoFormErrors;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CEP_REGEX = /^\d{5}-?\d{3}$/;

function validateEndereco(endereco: Endereco): EnderecoFormErrors {
  const errors: EnderecoFormErrors = {};

  if (!endereco.cep.trim()) {
    errors.cep = 'Informe o CEP.';
  } else if (!CEP_REGEX.test(endereco.cep.trim())) {
    errors.cep = 'Informe um CEP válido.';
  }

  if (!endereco.rua.trim()) errors.rua = 'Informe a rua.';
  if (!endereco.bairro.trim()) errors.bairro = 'Informe o bairro.';
  if (!endereco.cidade.trim()) errors.cidade = 'Informe a cidade.';
  if (!endereco.uf.trim()) errors.uf = 'Informe a UF.';
  if (!endereco.pais.trim()) errors.pais = 'Informe o país.';

  return errors;
}

export function validateClienteForm(values: ClienteFormValues): ClienteFormErrors {
  const errors: ClienteFormErrors = {};
  const nome = values.nome_completo.trim();
  const telefone = values.telefone.trim();
  const email = values.email.trim();
  const cpfCnpj = values.cpf_cnpj.trim();

  if (!nome) {
    errors.nome_completo = 'Informe o nome completo.';
  } else if (nome.length < 3) {
    errors.nome_completo = 'O nome deve ter pelo menos 3 caracteres.';
  }

  if (!telefone && !email) {
    const mensagem = 'Informe pelo menos um telefone ou e-mail.';
    errors.telefone = mensagem;
    errors.email = mensagem;
  } else if (email && !EMAIL_REGEX.test(email)) {
    errors.email = 'Informe um e-mail válido.';
  }

  if (!cpfCnpj) {
    errors.cpf_cnpj = values.tipo_pessoa === 'fisica' ? 'Informe o CPF.' : 'Informe o CNPJ.';
  } else if (!isValidCpfCnpj(cpfCnpj, values.tipo_pessoa)) {
    errors.cpf_cnpj = values.tipo_pessoa === 'fisica' ? 'Informe um CPF válido.' : 'Informe um CNPJ válido.';
  }

  if (values.data_nascimento && new Date(values.data_nascimento) > new Date()) {
    errors.data_nascimento = 'A data de nascimento não pode estar no futuro.';
  }

  const enderecoErrors = validateEndereco(values.endereco);
  if (Object.keys(enderecoErrors).length > 0) {
    errors.endereco = enderecoErrors;
  }

  return errors;
}

export function isClienteFormValid(values: ClienteFormValues): boolean {
  return Object.keys(validateClienteForm(values)).length === 0;
}
