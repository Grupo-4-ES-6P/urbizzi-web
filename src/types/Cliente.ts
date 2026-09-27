export type TipoPessoa = 'fisica' | 'juridica';

export interface Endereco {
  cep: string;
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  pais: string;
  complemento: string;
}

export interface Cliente {
  id_cliente: number;
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
  created_at: string;
  updated_at: string;
}

export type NovoClienteInput = Pick<
  Cliente,
  | 'nome_completo'
  | 'telefone'
  | 'email'
  | 'ativo'
  | 'tipo_pessoa'
  | 'cpf_cnpj'
  | 'data_nascimento'
  | 'estado_civil'
  | 'profissao'
  | 'endereco'
>;
