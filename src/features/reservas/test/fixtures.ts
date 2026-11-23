import { criarCliente } from '../../../api/clientes/clientes';
import type { Cliente } from '../../../types/Cliente';
import type { NovaReservaInput } from '../types';

/** "Agora" usado nos testes: 26/08/2026 19:40 (horário local). */
export const AGORA_TESTE = new Date(2026, 7, 26, 19, 40);

export function criarClienteTeste(nome = 'Marina Ferreira Duarte'): Promise<Cliente> {
  return criarCliente({
    nome_completo: nome,
    telefone: '(45) 99812-4477',
    email: '',
    ativo: true,
    tipo_pessoa: 'fisica',
    cpf_cnpj: '048.912.330-27',
    data_nascimento: '',
    estado_civil: '',
    profissao: '',
    endereco: { cep: '', rua: '', numero: '', bairro: '', cidade: '', uf: '', pais: 'Brasil', complemento: '' },
  });
}

export function novaReservaInput(overrides: Partial<NovaReservaInput> & Pick<NovaReservaInput, 'cliente_id'>): NovaReservaInput {
  return {
    imovel_id: 103,
    responsavel_id: 1,
    origem_interesse: 'Catálogo público',
    contato_recente: '',
    data_inicio: '2026-08-26',
    validade_dias: 15,
    avisar_horas_antes: 48,
    sinal: 5000,
    forma_pagamento: 'Entrada + 24x',
    desconto_percentual: 3,
    observacoes: '',
    ...overrides,
  };
}
