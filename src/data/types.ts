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

/**
 * Situação persistida da proposta. "Expirada" também é derivada da data em
 * `situacaoProposta` (lib/propostas), já que não há backend para gravá-la (RF21).
 */
export type SituacaoProposta =
  | 'rascunho'
  | 'enviada'
  | 'em_analise'
  | 'aguardando_diretoria'
  | 'aprovada'
  | 'recusada'
  | 'contraproposta'
  | 'expirada'

/**
 * Situação de cada versão, independente da situação da proposta (RF18).
 * "Expirada" só aparece na exibição, derivada da proposta.
 */
export type SituacaoVersao = 'rascunho' | 'em_analise' | 'aprovada' | 'recusada' | 'contraproposta' | 'substituida' | 'expirada'

/** Condições comerciais informadas; os valores derivados saem de `calcularCondicoes`. */
export interface CondicoesProposta {
  valorTabela: number
  /** Percentual sobre o valor de tabela, ex.: 3 para 3%. */
  descontoPercentual: number
  entrada: number
  parcelas: number
  indiceCorrecao: string
  /** YYYY-MM-DD */
  primeiroVencimento: string
  formaPagamento: string
  /** Validade em dias úteis contados a partir do envio. */
  validadeDias: number
  escritura: string
  garantia: string
}

export interface VersaoProposta {
  /** 1, 2, 3… — nunca reaproveitado nem sobrescrito depois do envio. */
  numero: number
  criadaEm: string
  autor: string
  enviadaEm?: string
  condicoes: CondicoesProposta
  /** Desconto acima da alçada do vendedor no momento do envio. */
  acimaDaAlcada: boolean
  aprovadorId: string
  observacoes: string
  /** Só os nomes: o upload real de anexos ainda não existe. */
  anexos: string[]
  /** Gerado comparando com a versão anterior. */
  oQueMudou: string
  comentario: string
  situacao: SituacaoVersao
}

export type TipoEtapa = 'envio' | 'analise_comercial' | 'diretoria' | 'contrato'
export type EstadoEtapa = 'concluida' | 'aguardando' | 'pendente' | 'recusada'

/** Etapa do fluxo de aprovação (RF19). */
export interface EtapaAprovacao {
  tipo: TipoEtapa
  titulo: string
  /** Usuário que decide a etapa; vazio nas etapas automáticas. */
  responsavelId: string
  responsavelNome: string
  cargo: string
  estado: EstadoEtapa
  automatica: boolean
  concluidaEm?: string
}

export type TipoEventoProposta =
  | 'criacao'
  | 'rascunho'
  | 'envio'
  | 'nova_versao'
  | 'analise'
  | 'aprovacao_etapa'
  | 'aprovacao'
  | 'recusa'
  | 'contraproposta'

/** Registro imutável de auditoria da proposta (RF32). */
export interface EventoProposta {
  id: string
  tipo: TipoEventoProposta
  data: string
  titulo: string
  autor: string
  detalhe: string
  versao: number
}

export interface Proposta {
  id: string
  /** Código de exibição no padrão PROP-AAAA-NNNN. */
  codigo: string
  /** Reserva ativa que originou a proposta (RF17). */
  reservaId: string
  imovelId: string
  clienteId: string
  corretorId: string
  situacao: SituacaoProposta
  criadaEm: string
  atualizadaEm: string
  /** Fim do prazo da versão enviada; vazio em rascunho (RF21). */
  expiraEm?: string
  decididaEm?: string
  motivoRecusa?: string
  versoes: VersaoProposta[]
  etapas: EtapaAprovacao[]
  historico: EventoProposta[]
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
