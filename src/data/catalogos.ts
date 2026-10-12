import type { Situacao } from './types'

export interface LoteamentoInicial {
  nome: string
  bairro: string
  cidade: string
  uf: string
  cep: string
  centro: { lat: number; lng: number }
  precoM2: number
  codigo: string
  endereco: string
  limiteRenovacoes: number
}

export const LOTEAMENTOS: LoteamentoInicial[] = [
  {
    nome: 'Lot. Universitário',
    limiteRenovacoes: 2,
    codigo: 'UNI-I',
    endereco: 'Rod. PR-317, km 12',
    bairro: 'Jardim Universitário',
    cidade: 'Toledo',
    uf: 'PR',
    cep: '85902-040',
    centro: { lat: -24.7205, lng: -53.752 },
    precoM2: 340,
  },
  {
    nome: 'Jd. Europa',
    limiteRenovacoes: 1,
    codigo: 'EUR',
    endereco: 'Av. Europa, 1500',
    bairro: 'Jardim Europa',
    cidade: 'Toledo',
    uf: 'PR',
    cep: '85905-330',
    centro: { lat: -24.733, lng: -53.729 },
    precoM2: 380,
  },
  {
    nome: 'Biopark Toledo',
    limiteRenovacoes: 3,
    codigo: 'BIO',
    endereco: 'Av. Max Planck, 3796',
    bairro: 'Vila Becker',
    cidade: 'Toledo',
    uf: 'PR',
    cep: '85919-899',
    centro: { lat: -24.7139, lng: -53.7403 },
    precoM2: 350,
  },
  {
    nome: 'Jd. Porto Alegre',
    limiteRenovacoes: 2,
    codigo: 'POA',
    endereco: 'Rua Guaíba, 800',
    bairro: 'Jardim Porto Alegre',
    cidade: 'Toledo',
    uf: 'PR',
    cep: '85906-210',
    centro: { lat: -24.701, lng: -53.761 },
    precoM2: 300,
  },
]

export const TIPOS_IMOVEL = ['Terreno em loteamento', 'Terreno avulso', 'Lote comercial', 'Chácara']

export const SITUACOES: { valor: Situacao; rotulo: string }[] = [
  { valor: 'disponivel', rotulo: 'Disponível' },
  { valor: 'reservado', rotulo: 'Reservado' },
  { valor: 'vendido', rotulo: 'Vendido' },
  { valor: 'bloqueado', rotulo: 'Bloqueado' },
]

export const TOPOGRAFIAS = ['Plano', 'Aclive', 'Declive', 'Irregular']

export const PRAZOS_RESERVA = [
  { horas: 24, rotulo: '24 horas' },
  { horas: 48, rotulo: '48 horas' },
  { horas: 72, rotulo: '72 horas' },
  { horas: 168, rotulo: '7 dias' },
]

export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

export function rotuloSituacao(s: Situacao) {
  return SITUACOES.find((x) => x.valor === s)?.rotulo ?? s
}

export const SITUACOES_LOTEAMENTO = [
  { valor: 'em_aprovacao', rotulo: 'Em aprovação' },
  { valor: 'em_registro', rotulo: 'Em registro' },
  { valor: 'em_comercializacao', rotulo: 'Em comercialização' },
  { valor: 'esgotado', rotulo: 'Esgotado' },
] as const

export const MOTIVOS_BLOQUEIO = [
  'Pendência de averbação',
  'Pendência documental',
  'Faixa de serviço / área técnica',
  'Decisão judicial',
  'Reserva da incorporadora',
  'Venda cancelada',
  'Outro',
]

export const MOTIVOS_CANCELAMENTO = [
  'Distrato por inadimplência',
  'Distrato a pedido do cliente',
  'Erro no registro da venda',
  'Outro',
]

export const TIPOS_DOCUMENTO = [
  'Matrícula atualizada',
  'Matrícula',
  'Planta do lote',
  'Licença ambiental',
  'Fotos do lote',
  'Contrato de reserva',
  'Proposta assinada',
  'Outro',
]
