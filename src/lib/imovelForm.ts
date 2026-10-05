import type { Imovel, Situacao, StatusPublicacao } from '../data/types'

export interface FormImovel {
  titulo: string
  matricula: string
  codigo: string
  tipo: string
  loteamento: string
  situacao: Situacao
  cep: string
  logradouro: string
  numero: string
  bairro: string
  cidade: string
  uf: string
  quadra: string
  lote: string
  lat: string
  lng: string
  areaTotal: number | null
  frente: number | null
  fundo: number | null
  topografia: string
  valorTabela: number | null
  valorMinimo: number | null
  prazoReservaHoras: number
  fotos: string[]
  catalogo: boolean
  reservasOnline: boolean
  destaque: boolean
}

export type ErrosForm = Partial<Record<keyof FormImovel, string>>

export function formVazio(codigo: string): FormImovel {
  return {
    titulo: '',
    matricula: '',
    codigo,
    tipo: 'Terreno em loteamento',
    loteamento: '',
    situacao: 'disponivel',
    cep: '',
    logradouro: '',
    numero: '',
    bairro: '',
    cidade: '',
    uf: '',
    quadra: '',
    lote: '',
    lat: '',
    lng: '',
    areaTotal: null,
    frente: null,
    fundo: null,
    topografia: 'Plano',
    valorTabela: null,
    valorMinimo: null,
    prazoReservaHoras: 72,
    fotos: [],
    catalogo: true,
    reservasOnline: true,
    destaque: false,
  }
}

export function formDeImovel(i: Imovel): FormImovel {
  return {
    titulo: i.titulo,
    matricula: i.matricula,
    codigo: i.codigo,
    tipo: i.tipo,
    loteamento: i.loteamento,
    situacao: i.situacao,
    ...i.endereco,
    lat: i.geo.lat === null ? '' : String(i.geo.lat),
    lng: i.geo.lng === null ? '' : String(i.geo.lng),
    areaTotal: i.dimensoes.areaTotal,
    frente: i.dimensoes.frente,
    fundo: i.dimensoes.fundo,
    topografia: i.dimensoes.topografia,
    valorTabela: i.valores.tabela,
    valorMinimo: i.valores.minimo,
    prazoReservaHoras: i.valores.prazoReservaHoras,
    fotos: i.fotos,
    ...i.publicacao,
  }
}

/** Aceita vírgula ou ponto como separador decimal. */
export function lerCoordenada(texto: string): number | null {
  const limpo = texto.trim().replace(',', '.')
  if (!limpo) return null
  const n = Number(limpo)
  return Number.isFinite(n) ? n : null
}

export function imovelDeForm(f: FormImovel, status: StatusPublicacao): Omit<Imovel, 'id' | 'criadoEm' | 'atualizadoEm'> {
  return {
    codigo: f.codigo.trim(),
    titulo: f.titulo.trim(),
    matricula: f.matricula.trim(),
    tipo: f.tipo,
    loteamento: f.loteamento,
    situacao: f.situacao,
    endereco: {
      cep: f.cep,
      logradouro: f.logradouro.trim(),
      numero: f.numero.trim(),
      bairro: f.bairro.trim(),
      cidade: f.cidade.trim(),
      uf: f.uf,
      quadra: f.quadra.trim(),
      lote: f.lote.trim(),
    },
    geo: { lat: lerCoordenada(f.lat), lng: lerCoordenada(f.lng) },
    dimensoes: { areaTotal: f.areaTotal, frente: f.frente, fundo: f.fundo, topografia: f.topografia },
    valores: { tabela: f.valorTabela, minimo: f.valorMinimo, prazoReservaHoras: f.prazoReservaHoras },
    publicacao: { catalogo: f.catalogo, reservasOnline: f.reservasOnline, destaque: f.destaque },
    fotos: f.fotos,
    status,
  }
}

const obrigatorio = 'Campo obrigatório.'

type Regra = (f: FormImovel) => string | undefined

const preenchido = (campo: 'logradouro' | 'bairro' | 'cidade' | 'uf' | 'lote' | 'matricula'): Regra => (f) =>
  f[campo].trim() ? undefined : obrigatorio

function regraTitulo(f: FormImovel) {
  const titulo = f.titulo.trim()
  if (!titulo) return obrigatorio
  return titulo.length < 5 ? 'Use pelo menos 5 caracteres.' : undefined
}

function regraCodigo(f: FormImovel) {
  const codigo = f.codigo.trim()
  if (!codigo) return obrigatorio
  return /^\d+$/.test(codigo) ? undefined : 'Use apenas números.'
}

function regraCoordenada(texto: string, limite: number, nome: string) {
  const valor = lerCoordenada(texto)
  if (valor === null) return texto.trim() ? `${nome} inválida.` : 'Informe ou marque no mapa.'
  return Math.abs(valor) > limite ? `Entre -${limite} e ${limite}.` : undefined
}

/** Uma regra por campo; a primeira mensagem encontrada vira o erro do campo. */
const REGRAS: Partial<Record<keyof FormImovel, Regra>> = {
  titulo: regraTitulo,
  matricula: preenchido('matricula'),
  codigo: regraCodigo,
  tipo: (f) => (f.tipo ? undefined : obrigatorio),
  loteamento: (f) => (f.tipo === 'Terreno em loteamento' && !f.loteamento ? 'Selecione o loteamento.' : undefined),
  cep: (f) => (f.cep.replace(/\D/g, '').length === 8 ? undefined : 'CEP deve ter 8 dígitos.'),
  logradouro: preenchido('logradouro'),
  numero: (f) => (f.numero.trim() ? undefined : 'Informe o número ou "s/n".'),
  bairro: preenchido('bairro'),
  cidade: preenchido('cidade'),
  uf: preenchido('uf'),
  lote: preenchido('lote'),
  lat: (f) => regraCoordenada(f.lat, 90, 'Latitude'),
  lng: (f) => regraCoordenada(f.lng, 180, 'Longitude'),
  areaTotal: (f) => (f.areaTotal ? undefined : 'Informe a área.'),
  valorTabela: (f) => (f.valorTabela ? undefined : 'Informe o valor.'),
  valorMinimo: (f) =>
    f.valorMinimo && f.valorTabela && f.valorMinimo > f.valorTabela
      ? 'Não pode ser maior que o valor de tabela.'
      : undefined,
  fotos: (f) => (f.catalogo && f.fotos.length === 0 ? 'Adicione ao menos uma foto para exibir no catálogo.' : undefined),
}

/** Regras para publicar. Rascunhos só exigem algo que os identifique. */
export function validarPublicacao(f: FormImovel): ErrosForm {
  const erros: ErrosForm = {}
  for (const [campo, regra] of Object.entries(REGRAS) as [keyof FormImovel, Regra][]) {
    const mensagem = regra(f)
    if (mensagem) erros[campo] = mensagem
  }
  return erros
}

export function podeSalvarRascunho(f: FormImovel) {
  return Boolean(f.titulo.trim() || f.lote.trim() || f.matricula.trim())
}
