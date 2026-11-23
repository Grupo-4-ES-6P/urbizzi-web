import { atualizarDb, lerDb } from '../data/db'
import type { Quadra } from '../data/types'
import { gerarQuadra as gerarLotesLocais, type LotePrevia } from './api'
import { http } from './http'

interface QuadraApi {
  id: string
  identificacao: string
  idLoteamento: string
  area: number | null
  testadaPara: string | null
  criadaEm: string
}

/** A API usa id numérico; ids de teste (lot-1) passam como estão. */
export const idNaApi = (id: string) => (/^\d+$/.test(id) ? Number(id) : id)

function paraQuadra(q: QuadraApi, nomes: Map<string, string>): Quadra {
  return {
    id: q.id,
    loteamento: nomes.get(String(q.idLoteamento)) ?? '',
    identificacao: q.identificacao,
    area: q.area,
    testadaPara: q.testadaPara ?? '',
    criadaEm: q.criadaEm,
  }
}

/** Depende dos loteamentos já espelhados para achar o nome de cada um. */
export async function sincronizarQuadras(signal?: AbortSignal) {
  const resposta = await http<QuadraApi[]>('/quadras', { signal })
  const nomes = new Map(lerDb().loteamentos.map((l) => [l.id, l.nome]))
  const quadras = resposta.map((q) => paraQuadra(q, nomes))
  atualizarDb((db) => ({ ...db, quadras }))
  return quadras
}

/** Grava a quadra na API; os lotes ainda são gerados localmente até o módulo de lote existir. */
export async function gerarQuadra(quadra: Omit<Quadra, 'id' | 'criadaEm'>, lotes: LotePrevia[], autor: string) {
  const loteamento = lerDb().loteamentos.find((l) => l.nome === quadra.loteamento)
  if (!loteamento) throw new Error('Loteamento não encontrado.')

  const salva = await http<QuadraApi>('/quadras', {
    method: 'POST',
    body: {
      identificacao: quadra.identificacao.trim(),
      idLoteamento: idNaApi(loteamento.id),
      area: quadra.area,
      testadaPara: quadra.testadaPara.trim() || null,
    },
  })
  return gerarLotesLocais(quadra, lotes, autor, { id: salva.id, criadaEm: salva.criadaEm })
}
