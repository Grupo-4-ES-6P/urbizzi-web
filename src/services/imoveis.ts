import { lerDb } from '../data/db'
import type { Imovel, Situacao } from '../data/types'
import { http } from './http'
import { idNaApi, sincronizarQuadras } from './quadras'

export interface LoteApi {
  id: string
  matricula: string | null
  tipo: string
  areaQuadrada: number | null
  valor: number | null
  estado: string
  informacoesComplementares: string | null
  latitude: number | null
  longitude: number | null
  publicado: boolean
  idQuadra: string | null
  detalhes: Partial<Imovel>
  createdAt: string
  updatedAt: string
}

export function paraImovel(l: LoteApi): Imovel {
  const d = l.detalhes ?? {}
  return {
    codigo: '',
    titulo: '',
    loteamento: '',
    status: 'publicado',
    fotos: [],
    ...d,
    id: l.id,
    matricula: l.matricula ?? '',
    tipo: l.tipo,
    situacao: l.estado as Situacao,
    observacao: l.informacoesComplementares ?? d.observacao,
    endereco: { cep: '', logradouro: '', numero: '', bairro: '', cidade: '', uf: '', quadra: '', lote: '', ...d.endereco },
    geo: { lat: l.latitude, lng: l.longitude },
    dimensoes: { frente: null, fundo: null, topografia: '', ...d.dimensoes, areaTotal: l.areaQuadrada },
    valores: { minimo: null, prazoReservaHoras: 72, ...d.valores, tabela: l.valor },
    publicacao: { reservasOnline: false, destaque: false, ...d.publicacao, catalogo: l.publicado },
    criadoEm: d.criadoEm ?? l.createdAt,
    atualizadoEm: l.updatedAt,
  }
}

/** Acha a quadra do imóvel na API; cria quando o loteamento existe e ela ainda não. */
async function idQuadraDe(imovel: Imovel) {
  const { loteamentos, quadras } = lerDb()
  const identificacao = imovel.endereco.quadra.trim()
  const loteamento = loteamentos.find((l) => l.nome === imovel.loteamento)
  if (!loteamento || !identificacao) return null

  const existente = quadras.find((q) => q.loteamento === loteamento.nome && q.identificacao === identificacao)
  if (existente) return idNaApi(existente.id)

  const criada = await http<{ id: string }>('/quadras', {
    method: 'POST',
    body: { identificacao, idLoteamento: idNaApi(loteamento.id) },
  })
  await sincronizarQuadras()
  return idNaApi(criada.id)
}

export async function imovelParaLote(i: Imovel) {
  const { matricula, tipo, situacao, observacao, geo, ...detalhes } = i
  delete (detalhes as Partial<Imovel>).id
  return {
    matricula: matricula.trim() || null,
    tipo: tipo.trim() || 'Terreno',
    areaQuadrada: i.dimensoes.areaTotal,
    valor: i.valores.tabela,
    estado: situacao,
    informacoesComplementares: observacao?.trim() || null,
    latitude: geo.lat,
    longitude: geo.lng,
    publicado: i.publicacao.catalogo,
    idQuadra: await idQuadraDe(i),
    detalhes,
  }
}
