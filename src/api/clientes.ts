import type { Cliente, Endereco, NovoClienteInput } from '../types/Cliente';

const STORAGE_KEY = 'urbizzi:clientes';

const ENDERECO_VAZIO: Endereco = {
  cep: '',
  rua: '',
  numero: '',
  bairro: '',
  cidade: '',
  uf: '',
  pais: '',
  complemento: '',
};

type ClienteArmazenado = Omit<Cliente, 'ativo' | 'tipo_pessoa' | 'cpf_cnpj' | 'data_nascimento' | 'estado_civil' | 'profissao' | 'endereco'> &
  Partial<Pick<Cliente, 'ativo' | 'tipo_pessoa' | 'cpf_cnpj' | 'data_nascimento' | 'estado_civil' | 'profissao' | 'endereco'>>;

function normalizarCliente(cliente: ClienteArmazenado): Cliente {
  return {
    ...cliente,
    ativo: cliente.ativo ?? true,
    tipo_pessoa: cliente.tipo_pessoa ?? 'fisica',
    cpf_cnpj: cliente.cpf_cnpj ?? '',
    data_nascimento: cliente.data_nascimento ?? '',
    estado_civil: cliente.estado_civil ?? '',
    profissao: cliente.profissao ?? '',
    endereco: { ...ENDERECO_VAZIO, ...cliente.endereco },
  };
}

function trimEndereco(endereco: Endereco): Endereco {
  return {
    cep: endereco.cep.trim(),
    rua: endereco.rua.trim(),
    numero: endereco.numero.trim(),
    bairro: endereco.bairro.trim(),
    cidade: endereco.cidade.trim(),
    uf: endereco.uf.trim().toUpperCase(),
    pais: endereco.pais.trim(),
    complemento: endereco.complemento.trim(),
  };
}

// Stub local persistido em localStorage: substituir por chamada HTTP real quando o backend de clientes existir.
function lerClientes(): Cliente[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const dados = JSON.parse(raw) as ClienteArmazenado[];
    if (!Array.isArray(dados)) return [];

    return dados.map(normalizarCliente);
  } catch {
    return [];
  }
}

function salvarClientes(clientes: Cliente[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clientes));
}

function proximoId(clientes: Cliente[]): number {
  return clientes.reduce((max, cliente) => Math.max(max, cliente.id_cliente), 0) + 1;
}

export async function criarCliente(dados: NovoClienteInput): Promise<Cliente> {
  const clientes = lerClientes();
  const agora = new Date().toISOString();

  const cliente: Cliente = {
    id_cliente: proximoId(clientes),
    nome_completo: dados.nome_completo.trim(),
    telefone: dados.telefone.trim(),
    email: dados.email.trim(),
    ativo: dados.ativo,
    tipo_pessoa: dados.tipo_pessoa,
    cpf_cnpj: dados.cpf_cnpj.trim(),
    data_nascimento: dados.data_nascimento.trim(),
    estado_civil: dados.estado_civil.trim(),
    profissao: dados.profissao.trim(),
    endereco: trimEndereco(dados.endereco),
    created_at: agora,
    updated_at: agora,
  };

  salvarClientes([...clientes, cliente]);

  return cliente;
}

export async function listarClientes(): Promise<Cliente[]> {
  return [...lerClientes()].sort((a, b) => a.nome_completo.localeCompare(b.nome_completo, 'pt-BR'));
}

export async function buscarClientePorId(id: number): Promise<Cliente | undefined> {
  return lerClientes().find((cliente) => cliente.id_cliente === id);
}

export async function atualizarCliente(id: number, dados: NovoClienteInput): Promise<Cliente> {
  const clientes = lerClientes();
  const index = clientes.findIndex((cliente) => cliente.id_cliente === id);

  if (index === -1) {
    throw new Error(`Cliente ${id} não encontrado.`);
  }

  const atualizado: Cliente = {
    ...clientes[index],
    nome_completo: dados.nome_completo.trim(),
    telefone: dados.telefone.trim(),
    email: dados.email.trim(),
    ativo: dados.ativo,
    tipo_pessoa: dados.tipo_pessoa,
    cpf_cnpj: dados.cpf_cnpj.trim(),
    data_nascimento: dados.data_nascimento.trim(),
    estado_civil: dados.estado_civil.trim(),
    profissao: dados.profissao.trim(),
    endereco: trimEndereco(dados.endereco),
    updated_at: new Date().toISOString(),
  };

  clientes[index] = atualizado;
  salvarClientes(clientes);

  return atualizado;
}

export async function excluirClientes(ids: number[]): Promise<void> {
  const idsSet = new Set(ids);
  salvarClientes(lerClientes().filter((cliente) => !idsSet.has(cliente.id_cliente)));
}

export async function atualizarStatusClientes(ids: number[], ativo: boolean): Promise<void> {
  const idsSet = new Set(ids);
  const agora = new Date().toISOString();

  salvarClientes(
    lerClientes().map((cliente) =>
      idsSet.has(cliente.id_cliente) ? { ...cliente, ativo, updated_at: agora } : cliente,
    ),
  );
}
