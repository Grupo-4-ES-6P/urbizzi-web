import { atualizarDb, lerDb } from '../data/db'
import type { Db, Imovel, Situacao } from '../data/types'
import { http } from './http'
import { idNaApi, sincronizarQuadras } from './quadras'

interface LoteApi {
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

/** Coleções locais que apontam para um imóvel pelo id. */
const REFERENCIAS = ['historico', 'documentos', 'reservas', 'propostas', 'vendas', 'interesses'] as const

function paraImovel(l: LoteApi): Imovel {
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
    observacao: l.informacoesComplementares ?? undefined,
    endereco: { cep: '', logradouro: '', numero: '', bairro: '', cidade: '', uf: '', quadra: '', lote: '', ...d.endereco },
    geo: { lat: l.latitude, lng: l.longitude },
    dimensoes: { frente: null, fundo: null, topografia: '', ...d.dimensoes, areaTotal: l.areaQuadrada },
    valores: { minimo: null, prazoReservaHoras: 72, ...d.valores, tabela: l.valor },
    publicacao: { reservasOnline: false, destaque: false, ...d.publicacao, catalogo: l.publicado },
    criadoEm: d.criadoEm ?? l.createdAt,
    atualizadoEm: l.updatedAt,
  }
}

function paraApi(i: Imovel, idQuadra: number | string | null) {
  const { matricula, tipo, situacao, observacao, geo, ...resto } = i
  delete (resto as Partial<Imovel>).id
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
    idQuadra,
    detalhes: resto,
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

function semRegistrosOrfaos(db: Db, imoveis: Imovel[]): Db {
  const ids = new Set(imoveis.map((i) => i.id))
  const limpo = { ...db, imoveis }
  for (const chave of REFERENCIAS) {
    const lista = db[chave] as { imovelId?: string }[]
    ;(limpo[chave] as typeof lista) = lista.filter((r) => !r.imovelId || ids.has(r.imovelId))
  }
  return limpo
}

export async function sincronizarImoveis(signal?: AbortSignal) {
  const imoveis = (await http<LoteApi[]>('/lote', { signal })).map(paraImovel)
  atualizarDb((db) => semRegistrosOrfaos(db, imoveis))
  return imoveis
}

function trocarIds(db: Db, novos: Map<string, string>): Db {
  const troca = (id: string) => novos.get(id) ?? id
  const atualizado = { ...db, imoveis: db.imoveis.map((i) => ({ ...i, id: troca(i.id) })) }
  for (const chave of REFERENCIAS) {
    const lista = db[chave] as { imovelId?: string }[]
    ;(atualizado[chave] as typeof lista) = lista.map((r) =>
      r.imovelId && novos.has(r.imovelId) ? { ...r, imovelId: troca(r.imovelId) } : r,
    )
  }
  return atualizado
}

/**
 * Roda uma operação que altera imóveis no banco local e envia a diferença
 * para a API. Se a API falhar, o espelho é refeito a partir dela.
 */
export async function comSincronizacaoDeImoveis<T>(operacao: () => Promise<T>): Promise<T> {
  const antes = new Map(lerDb().imoveis.map((i) => [i.id, i]))
  const resultado = await operacao()
  const depois = lerDb().imoveis
  const novos = new Map<string, string>()

  try {
    for (const imovel of depois) {
      const anterior = antes.get(imovel.id)
      if (anterior && JSON.stringify(anterior) === JSON.stringify(imovel)) continue
      const corpo = paraApi(imovel, await idQuadraDe(imovel))
      if (anterior) {
        await http(`/lote/${imovel.id}`, { method: 'PUT', body: corpo })
      } else {
        const criado = await http<LoteApi>('/lote', { method: 'POST', body: corpo })
        novos.set(imovel.id, criado.id)
      }
    }
    const restantes = new Set(depois.map((i) => i.id))
    for (const id of antes.keys()) {
      if (!restantes.has(id)) await http(`/lote/${id}`, { method: 'DELETE' })
    }
  } catch (error_) {
    await sincronizarImoveis().catch(() => undefined)
    throw error_
  }

  if (!novos.size) return resultado
  atualizarDb((db) => trocarIds(db, novos))
  // Quem recebeu o imóvel criado (ex.: o formulário) precisa do id da API.
  const id = (resultado as { id?: unknown } | null)?.id
  return typeof id === 'string' && novos.has(id) ? ({ ...resultado, id: novos.get(id) } as T) : resultado
}
