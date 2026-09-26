import type { Situacao } from './types'

export interface Loteamento {
  nome: string
  bairro: string
  cidade: string
  uf: string
  cep: string
  centro: { lat: number; lng: number }
  precoM2: number
}

export const LOTEAMENTOS: Loteamento[] = [
  {
    nome: 'Lot. Universitário',
    bairro: 'Jardim Universitário',
    cidade: 'Toledo',
    uf: 'PR',
    cep: '85902-040',
    centro: { lat: -24.7205, lng: -53.752 },
    precoM2: 340,
  },
  {
    nome: 'Jd. Europa',
    bairro: 'Jardim Europa',
    cidade: 'Toledo',
    uf: 'PR',
    cep: '85905-330',
    centro: { lat: -24.733, lng: -53.729 },
    precoM2: 380,
  },
  {
    nome: 'Biopark Toledo',
    bairro: 'Vila Becker',
    cidade: 'Toledo',
    uf: 'PR',
    cep: '85919-899',
    centro: { lat: -24.7139, lng: -53.7403 },
    precoM2: 350,
  },
  {
    nome: 'Jd. Porto Alegre',
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
  { valor: 'indisponivel', rotulo: 'Indisponível' },
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

export function buscarLoteamento(nome: string) {
  return LOTEAMENTOS.find((l) => l.nome === nome)
}
