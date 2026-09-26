export type Situacao = 'disponivel' | 'reservado' | 'vendido' | 'indisponivel'
export type StatusPublicacao = 'publicado' | 'rascunho'

export interface Endereco {
  cep: string
  logradouro: string
  numero: string
  bairro: string
  cidade: string
  uf: string
  quadra: string
  lote: string
}

export interface Imovel {
  id: string
  codigo: string
  titulo: string
  matricula: string
  tipo: string
  loteamento: string
  situacao: Situacao
  endereco: Endereco
  geo: { lat: number | null; lng: number | null }
  dimensoes: { areaTotal: number | null; frente: number | null; fundo: number | null; topografia: string }
  valores: { tabela: number | null; minimo: number | null; prazoReservaHoras: number }
  publicacao: { catalogo: boolean; reservasOnline: boolean; destaque: boolean }
  /** Data URLs já redimensionadas; a primeira é a capa. */
  fotos: string[]
  status: StatusPublicacao
  criadoEm: string
  atualizadoEm: string
}

export interface Pessoa {
  id: string
  nome: string
}

export type StatusReserva = 'ativa' | 'convertida' | 'cancelada'

export interface Reserva {
  id: string
  imovelId: string
  clienteId: string
  corretorId: string
  criadaEm: string
  expiraEm: string
  status: StatusReserva
}

export type StatusProposta = 'pendente' | 'aprovada' | 'recusada'

export interface Proposta {
  id: string
  imovelId: string
  clienteId: string
  corretorId: string
  valor: number
  /** Condição de pagamento, ex.: "Entrada 30% + 24x". */
  condicao?: string
  status: StatusProposta
  criadaEm: string
  decididaEm?: string
  motivoRecusa?: string
}

export interface Venda {
  id: string
  imovelId: string
  clienteId: string
  propostaId?: string
  valor: number
  data: string
}

export interface Usuario {
  id: string
  nome: string
  email: string
  senha: string
  papel: string
}

export type UsuarioPublico = Omit<Usuario, 'senha'>

export interface Db {
  versao: number
  imoveis: Imovel[]
  clientes: Pessoa[]
  corretores: Pessoa[]
  reservas: Reserva[]
  propostas: Proposta[]
  vendas: Venda[]
  usuarios: Usuario[]
}
