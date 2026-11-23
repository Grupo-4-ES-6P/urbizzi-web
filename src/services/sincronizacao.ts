import { atualizarDb, lerDb } from '../data/db'
import { perfilDaApi } from '../data/permissoes'
import type { Db, Imovel, Proposta } from '../data/types'
import { sincronizarClientes } from './clientes'
import { http } from './http'
import { imovelParaLote, paraImovel, type LoteApi } from './imoveis'
import { sincronizarLoteamentos } from './loteamentos'
import { idNaApi, sincronizarQuadras } from './quadras'

type Chave = 'imoveis' | 'propostas' | 'reservas' | 'vendas' | 'interesses' | 'historico' | 'documentos'
type Item = { id: string } & Record<string, unknown>
type Traduzir = (id: string) => string

interface Colecao {
  chave: Chave
  rota: string
  metodoEdicao: 'PUT' | 'PATCH'
  /** Campos que apontam para itens de outras coleções (trocados quando o item ganha id da API). */
  referencias: string[]
  idDaResposta: (resposta: Record<string, unknown>) => string
  paraApi: (item: Item, traduzir: Traduzir) => Promise<object> | object
  daApi: (resposta: Record<string, unknown>) => Item
}

interface RegistroApi {
  id: string
  idLote: string | null
  idCliente: string | null
  status: string | null
  detalhes: Record<string, unknown>
}

const texto = (valor: unknown) => (typeof valor === 'string' && valor ? valor : null)
const dataIso = (valor: unknown) => {
  const t = texto(valor)
  return t && !Number.isNaN(Date.parse(t)) ? new Date(t).toISOString() : null
}
const idApi = (valor: unknown, traduzir: Traduzir = (id) => id) => {
  const t = texto(valor)
  return t ? idNaApi(traduzir(t)) : null
}

/** Registros genéricos da API: o item vai inteiro em detalhes e as colunas servem a filtros e regras. */
function registro(
  chave: Chave,
  rota: string,
  campos: { imovel?: string; cliente?: string; status?: string; data?: string; valor?: string; codigo?: string },
  referencias: string[] = [],
): Colecao {
  return {
    chave,
    rota,
    metodoEdicao: 'PUT',
    referencias: ['imovelId', ...referencias],
    idDaResposta: (r) => String(r.id),
    paraApi: (item, traduzir) => {
      const detalhes: Record<string, unknown> = { ...item }
      delete detalhes.id
      for (const ref of referencias) if (typeof detalhes[ref] === 'string') detalhes[ref] = traduzir(detalhes[ref])
      return {
        codigo: campos.codigo ? texto(item[campos.codigo]) : null,
        idLote: campos.imovel ? idApi(item[campos.imovel], traduzir) : null,
        idCliente: campos.cliente ? idApi(item[campos.cliente]) : null,
        status: campos.status ? texto(item[campos.status]) : null,
        data: campos.data ? dataIso(item[campos.data]) : null,
        valor: campos.valor && typeof item[campos.valor] === 'number' ? item[campos.valor] : null,
        detalhes,
      }
    },
    daApi: (resposta) => {
      const r = resposta as unknown as RegistroApi
      const item: Item = { ...r.detalhes, id: r.id }
      if (campos.imovel && r.idLote) item[campos.imovel] = r.idLote
      if (campos.cliente && r.idCliente) item[campos.cliente] = r.idCliente
      if (campos.status && r.status) item[campos.status] = r.status
      return item
    },
  }
}

interface PropostaApi {
  idProposta: number
  status: string
  idLote: number
  idCliente: number
  detalhes: Record<string, unknown>
}

const COLECOES: Colecao[] = [
  {
    chave: 'imoveis',
    rota: '/lote',
    metodoEdicao: 'PUT',
    referencias: [],
    idDaResposta: (r) => String(r.id),
    paraApi: (item) => imovelParaLote(item as unknown as Imovel),
    daApi: (r) => paraImovel(r as unknown as LoteApi) as unknown as Item,
  },
  {
    chave: 'propostas',
    rota: '/propostas',
    metodoEdicao: 'PATCH',
    referencias: ['imovelId'],
    idDaResposta: (r) => String(r.idProposta),
    paraApi: (item, traduzir) => {
      const p = item as unknown as Proposta
      const detalhes: Record<string, unknown> = { ...item }
      delete detalhes.id
      return {
        valor: String(p.valor ?? 0),
        condicoes: p.condicao?.trim() || 'A combinar',
        observacoes: p.observacoes ?? null,
        status: p.status,
        justificativa: p.motivoRecusa ?? null,
        prazoResposta: dataIso(p.expiraEm),
        idLote: idApi(p.imovelId, traduzir),
        idCliente: idApi(p.clienteId),
        codigo: texto(p.codigo),
        detalhes,
      }
    },
    daApi: (resposta) => {
      const r = resposta as unknown as PropostaApi
      return { ...r.detalhes, id: String(r.idProposta), status: r.status, imovelId: String(r.idLote), clienteId: String(r.idCliente) }
    },
  },
  registro('reservas', '/reservas', { imovel: 'imovelId', cliente: 'clienteId', status: 'status', data: 'expiraEm', codigo: 'codigo' }),
  registro(
    'vendas',
    '/vendas',
    { imovel: 'imovelId', cliente: 'clienteId', status: 'status', data: 'data', valor: 'valor', codigo: 'codigo' },
    ['propostaId'],
  ),
  registro('interesses', '/interesses', { imovel: 'imovelId', data: 'criadoEm', codigo: 'codigo' }),
  registro('historico', '/historico', { imovel: 'imovelId', status: 'tipo', data: 'data' }),
  registro('documentos', '/documentos', { imovel: 'imovelId', status: 'tipo', data: 'data' }),
]

interface MembroEquipe {
  id: string
  nome: string
  perfil: string
  ativo: boolean
}

async function sincronizarEquipe(signal?: AbortSignal) {
  const equipe = await http<MembroEquipe[]>('/users/equipe', { signal })
  atualizarDb((db) => ({
    ...db,
    corretores: equipe.filter((m) => m.ativo).map((m) => ({ id: m.id, nome: m.nome })),
    usuarios: equipe.map((m) => ({ id: m.id, nome: m.nome, email: '', senha: '', papel: perfilDaApi(m.perfil), ativo: m.ativo })),
  }))
}

/** Espelha na base local tudo o que já vem da API (as telas leem dali). */
export async function sincronizarComApi(signal?: AbortSignal) {
  await sincronizarLoteamentos(signal)
  await sincronizarQuadras(signal)
  await sincronizarEquipe(signal)
  await sincronizarClientes(signal)
  const respostas = await Promise.all(
    COLECOES.map((c) => http<Record<string, unknown>[]>(c.rota, { signal }).then((lista) => lista.map(c.daApi))),
  )
  atualizarDb((db) => {
    const atualizado = { ...db } as Record<Chave, Item[]> & Db
    COLECOES.forEach((c, i) => {
      ;(atualizado as Record<Chave, Item[]>)[c.chave] = respostas[i]
    })
    return atualizado
  })
}

/** Catálogo para o visitante: só imóveis publicados, sem dados internos. */
export async function sincronizarCatalogo(signal?: AbortSignal) {
  const { imoveis, loteamentos } = await http<{ imoveis: LoteApi[]; loteamentos: { idLoteamento: number; nome: string }[] }>(
    '/publico/catalogo',
    { signal },
  )
  atualizarDb((db) => ({
    ...db,
    imoveis: imoveis.map(paraImovel),
    loteamentos: loteamentos.map((l) => ({ ...db.loteamentos.find((x) => x.nome === l.nome), ...l, id: String(l.idLoteamento) })) as Db['loteamentos'],
  }))
}

function trocarIds(db: Db, novos: Map<string, string>): Db {
  const troca = (v: unknown) => (typeof v === 'string' && novos.has(v) ? novos.get(v) : v)
  const atualizado = { ...db } as Record<Chave, Item[]> & Db
  for (const c of COLECOES) {
    const lista = (db as unknown as Record<Chave, Item[]>)[c.chave]
    ;(atualizado as Record<Chave, Item[]>)[c.chave] = lista.map((item) => {
      const novo: Item = { ...item, id: troca(item.id) as string }
      for (const ref of ['imovelId', 'propostaId']) if (ref in novo) novo[ref] = troca(novo[ref])
      return novo
    })
  }
  return atualizado
}

/**
 * Roda uma operação que altera o banco local e envia a diferença para a API,
 * coleção por coleção (imóveis antes de quem aponta para eles). Se a API
 * falhar, o espelho é refeito a partir dela.
 */
export async function comSincronizacao<T>(operacao: () => Promise<T> | T): Promise<T> {
  const ler = () => lerDb() as unknown as Record<Chave, Item[]>
  const antes = new Map(COLECOES.map((c) => [c.chave, new Map(ler()[c.chave].map((i) => [i.id, i]))]))
  const resultado = await operacao()
  const depois = ler()
  const novos = new Map<string, string>()
  const traduzir: Traduzir = (id) => novos.get(id) ?? id

  try {
    for (const c of COLECOES) {
      const anteriores = antes.get(c.chave)!
      for (const item of depois[c.chave]) {
        const anterior = anteriores.get(item.id)
        if (anterior && JSON.stringify(anterior) === JSON.stringify(item)) continue
        const corpo = await c.paraApi(item, traduzir)
        if (anterior) {
          await http(`${c.rota}/${traduzir(item.id)}`, { method: c.metodoEdicao, body: corpo })
        } else {
          const criado = await http<Record<string, unknown>>(c.rota, { method: 'POST', body: corpo })
          novos.set(item.id, c.idDaResposta(criado))
        }
      }
    }
    // Exclusões ao contrário: quem aponta para o imóvel sai antes dele.
    for (const c of [...COLECOES].reverse()) {
      const restantes = new Set(depois[c.chave].map((i) => i.id))
      for (const id of antes.get(c.chave)!.keys()) {
        if (!restantes.has(id)) await http(`${c.rota}/${id}`, { method: 'DELETE' })
      }
    }
  } catch (error_) {
    await sincronizarComApi().catch(() => undefined)
    throw error_
  }

  if (!novos.size) return resultado
  atualizarDb((db) => trocarIds(db, novos))
  // Quem recebeu o item criado (ex.: o formulário) precisa do id da API.
  if (typeof resultado === 'string' && novos.has(resultado)) return novos.get(resultado) as T
  const id = (resultado as { id?: unknown } | null)?.id
  return typeof id === 'string' && novos.has(id) ? ({ ...resultado, id: novos.get(id) } as T) : resultado
}
