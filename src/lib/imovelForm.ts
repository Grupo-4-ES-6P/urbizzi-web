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

/** Regras para publicar. Rascunhos só exigem algo que os identifique. */
export function validarPublicacao(f: FormImovel): ErrosForm {
  const e: ErrosForm = {}
  if (!f.titulo.trim()) e.titulo = obrigatorio
  else if (f.titulo.trim().length < 5) e.titulo = 'Use pelo menos 5 caracteres.'
  if (!f.matricula.trim()) e.matricula = obrigatorio
  if (!f.codigo.trim()) e.codigo = obrigatorio
  else if (!/^\d+$/.test(f.codigo.trim())) e.codigo = 'Use apenas números.'
  if (!f.tipo) e.tipo = obrigatorio
  if (f.tipo === 'Terreno em loteamento' && !f.loteamento) e.loteamento = 'Selecione o loteamento.'

  if (f.cep.replace(/\D/g, '').length !== 8) e.cep = 'CEP deve ter 8 dígitos.'
  if (!f.logradouro.trim()) e.logradouro = obrigatorio
  if (!f.numero.trim()) e.numero = 'Informe o número ou "s/n".'
  if (!f.bairro.trim()) e.bairro = obrigatorio
  if (!f.cidade.trim()) e.cidade = obrigatorio
  if (!f.uf) e.uf = obrigatorio
  if (!f.lote.trim()) e.lote = obrigatorio

  const lat = lerCoordenada(f.lat)
  const lng = lerCoordenada(f.lng)
  if (lat === null) e.lat = f.lat.trim() ? 'Latitude inválida.' : 'Informe ou marque no mapa.'
  else if (lat < -90 || lat > 90) e.lat = 'Entre -90 e 90.'
  if (lng === null) e.lng = f.lng.trim() ? 'Longitude inválida.' : 'Informe ou marque no mapa.'
  else if (lng < -180 || lng > 180) e.lng = 'Entre -180 e 180.'

  if (!f.areaTotal) e.areaTotal = 'Informe a área.'
  if (!f.valorTabela) e.valorTabela = 'Informe o valor.'
  if (f.valorMinimo && f.valorTabela && f.valorMinimo > f.valorTabela) {
    e.valorMinimo = 'Não pode ser maior que o valor de tabela.'
  }
  if (f.catalogo && f.fotos.length === 0) {
    e.fotos = 'Adicione ao menos uma foto para exibir no catálogo.'
  }
  return e
}

export function podeSalvarRascunho(f: FormImovel) {
  return Boolean(f.titulo.trim() || f.lote.trim() || f.matricula.trim())
}
