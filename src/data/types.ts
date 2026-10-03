export type Situacao = 'disponivel' | 'reservado' | 'vendido' | 'bloqueado'
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
  /** Observação interna (ex.: "Esquina", "Faixa de serviço"). */
  observacao?: string
  /** Preenchido enquanto o imóvel está bloqueado. */
  bloqueio?: { motivo: string; justificativa: string; previsao?: string; em: string }
  status: StatusPublicacao
  criadoEm: string
  atualizadoEm: string
}

export interface Pessoa {
  id: string
  nome: string
}

export type TipoPessoa = 'fisica' | 'juridica'

export interface EnderecoCliente {
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  uf: string
  pais: string
}

export interface Cliente extends Pessoa {
  tipoPessoa: TipoPessoa
  /** Com máscara, ex.: 048.912.330-27 */
  cpfCnpj: string
  /** YYYY-MM-DD; vazio quando não informado. */
  dataNascimento: string
  estadoCivil: string
  profissao: string
  telefone: string
  email: string
  ativo: boolean
  endereco: EnderecoCliente
  criadoEm: string
  atualizadoEm: string
}

export type StatusReserva = 'ativa' | 'expirada' | 'cancelada' | 'convertida'

/** Situação exibida: reservas ativas são classificadas pelo tempo restante. */
export type SituacaoReserva = 'ativa' | 'atencao' | 'critico' | 'expirada' | 'cancelada' | 'convertida'

export type TipoEventoReserva = 'criacao' | 'renovacao' | 'aviso' | 'expiracao' | 'cancelamento' | 'conversao'

/** Registro de auditoria da reserva (RF32). */
export interface EventoReserva {
  id: string
  tipo: TipoEventoReserva
  data: string
  titulo: string
  autor: string
  detalhe: string
  situacao: SituacaoReserva
}

export interface Reserva {
  id: string
  /** Código de exibição, ex.: RES-2026-0184 */
  codigo: string
  imovelId: string
  clienteId: string
  corretorId: string
  criadaEm: string
  /** Data inicial de calendário (YYYY-MM-DD). */
  dataInicio: string
  validadeDias: number
  /** Instante em que a reserva vence (fim do dia da expiração). */
  expiraEm: string
  status: StatusReserva
  renovacoesUsadas: number
  /** Limite herdado do loteamento no momento da criação (RF15). */
  renovacoesPermitidas: number
  avisarHorasAntes: number
  valorTabela: number | null
  sinal: number | null
  formaPagamento: string
  descontoPercentual: number | null
  origemInteresse: string
  contatoRecente: string
  observacoes: string
  atualizadaEm: string
  historico: EventoReserva[]
}

export type StatusProposta = 'pendente' | 'aprovada' | 'recusada'

export interface Proposta {
  id: string
  /** Código de exibição, ex.: PROP-2026-0311 */
  codigo: string
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
  /** Código de exibição, ex.: VD-2026-0092 */
  codigo: string
  imovelId: string
  clienteId: string
  propostaId?: string
  valor: number
  data: string
  status: 'ativa' | 'cancelada'
  cancelamento?: { motivo: string; dataDistrato: string; devolucao: number; em: string }
}

export type SituacaoLoteamento = 'em_aprovacao' | 'em_registro' | 'em_comercializacao' | 'esgotado'

export interface Loteamento {
  id: string
  nome: string
  /** Prefixo do identificador dos lotes, ex.: UNI-I */
  codigo: string
  situacao: SituacaoLoteamento
  dataAprovacao: string
  cep: string
  endereco: string
  bairro: string
  cidade: string
  uf: string
  matriculaMae: string
  areaTotal: number | null
  areaLoteavel: number | null
  centro: { lat: number; lng: number } | null
  cartorio: string
  numeroRegistro: string
  licencaAmbiental: string
  validadeLicenca: string
  /** Quantas vezes uma reserva pode ser renovada neste loteamento (RF15). */
  limiteRenovacoes: number
}

export interface Quadra {
  id: string
  /** Nome do loteamento (mesma chave usada em Imovel.loteamento). */
  loteamento: string
  identificacao: string
  area: number | null
  testadaPara: string
  criadaEm: string
}

export interface Interesse {
  id: string
  codigo: string
  imovelId: string
  nome: string
  email: string
  telefone: string
  mensagem: string
  criadoEm: string
}

export type VarianteBadge = 'normal' | 'atencao' | 'critico' | 'neutro' | 'escuro' | 'laranja' | 'rascunho'

export interface EventoHistorico {
  id: string
  imovelId: string
  data: string
  tipo: string
  descricao: string
  autor: string
  referencia?: string
  situacao: { rotulo: string; variante: VarianteBadge }
}

export interface Documento {
  id: string
  imovelId: string
  tipo: string
  arquivo: string
  /** bytes */
  tamanho: number
  versao: number
  enviadoPor: string
  data: string
  validade?: string
  visivelCatalogo: boolean
  aguardandoAssinatura?: boolean
  substituido: boolean
  /** Conteúdo em data URL, guardado só para arquivos pequenos (demonstração). */
  conteudo?: string
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
  clientes: Cliente[]
  corretores: Pessoa[]
  reservas: Reserva[]
  propostas: Proposta[]
  vendas: Venda[]
  usuarios: Usuario[]
  loteamentos: Loteamento[]
  quadras: Quadra[]
  interesses: Interesse[]
  historico: EventoHistorico[]
  documentos: Documento[]
}
