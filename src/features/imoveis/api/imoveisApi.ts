import type { Imovel, Loteamento } from '../types';

// Catálogo mock: substituir por chamadas HTTP quando o módulo de Imóveis/Loteamentos existir no backend.
const LOTEAMENTOS: Loteamento[] = [
  { id: 1, nome: 'Universitário I', limite_renovacoes: 2 },
  { id: 2, nome: 'Jardim Europa', limite_renovacoes: 1 },
  { id: 3, nome: 'Biopark Toledo', limite_renovacoes: 3 },
];

const IMOVEIS: Imovel[] = [
  { id: 101, loteamento_id: 1, quadra: '01', lote: '09', matricula: '41.880', valor_tabela: 420000, situacao_cadastral: 'disponivel' },
  { id: 102, loteamento_id: 1, quadra: '02', lote: '07', matricula: '41.895', valor_tabela: 438000, situacao_cadastral: 'disponivel' },
  { id: 103, loteamento_id: 1, quadra: '04', lote: '12', matricula: '41.902', valor_tabela: 455000, situacao_cadastral: 'disponivel' },
  { id: 104, loteamento_id: 1, quadra: '04', lote: '13', matricula: '41.903', valor_tabela: 455000, situacao_cadastral: 'disponivel' },
  { id: 105, loteamento_id: 1, quadra: '05', lote: '02', matricula: '41.911', valor_tabela: 470000, situacao_cadastral: 'vendido' },
  { id: 201, loteamento_id: 2, quadra: '07', lote: '03', matricula: '52.310', valor_tabela: 389000, situacao_cadastral: 'disponivel' },
  { id: 202, loteamento_id: 2, quadra: '09', lote: '18', matricula: '52.344', valor_tabela: 395000, situacao_cadastral: 'disponivel' },
  { id: 203, loteamento_id: 2, quadra: '09', lote: '19', matricula: '52.345', valor_tabela: 395000, situacao_cadastral: 'disponivel' },
  { id: 204, loteamento_id: 2, quadra: null, lote: '44', matricula: '52.401', valor_tabela: 512000, situacao_cadastral: 'disponivel' },
  { id: 301, loteamento_id: 3, quadra: null, lote: '27', matricula: '60.127', valor_tabela: 610000, situacao_cadastral: 'disponivel' },
  { id: 302, loteamento_id: 3, quadra: null, lote: '31', matricula: '60.131', valor_tabela: 640000, situacao_cadastral: 'disponivel' },
  { id: 303, loteamento_id: 3, quadra: null, lote: '32', matricula: '60.132', valor_tabela: 640000, situacao_cadastral: 'disponivel' },
  { id: 304, loteamento_id: 3, quadra: null, lote: '40', matricula: '60.140', valor_tabela: 700000, situacao_cadastral: 'vendido' },
];

export async function listarLoteamentos(): Promise<Loteamento[]> {
  return [...LOTEAMENTOS];
}

export async function listarImoveis(): Promise<Imovel[]> {
  return [...IMOVEIS];
}

export async function buscarImovel(id: number): Promise<Imovel | undefined> {
  return IMOVEIS.find((imovel) => imovel.id === id);
}

export async function buscarLoteamento(id: number): Promise<Loteamento | undefined> {
  return LOTEAMENTOS.find((loteamento) => loteamento.id === id);
}
