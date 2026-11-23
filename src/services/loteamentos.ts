import { atualizarDb, lerDb } from '../data/db'
import type { Loteamento, SituacaoLoteamento } from '../data/types'
import { mascaraCep } from '../lib/format'
import { http } from './http'

interface LoteamentoApi {
  idLoteamento: number
  nome: string
  descricao: string
  situacao: string
  publicado: boolean
  idBairro: number | null
  codigo: string | null
  dataAprovacao: string | null
  cep: string | null
  endereco: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  matriculaMae: string | null
  areaTotal: number | null
  areaLoteavel: number | null
  latitude: number | null
  longitude: number | null
  cartorio: string | null
  numeroRegistro: string | null
  licencaAmbiental: string | null
  validadeLicenca: string | null
}

export type DadosLoteamento = Omit<Loteamento, 'id'> & { id?: string }

function paraLoteamento(l: LoteamentoApi): Loteamento {
  return {
    id: String(l.idLoteamento),
    nome: l.nome,
    codigo: l.codigo ?? '',
    situacao: l.situacao as SituacaoLoteamento,
    dataAprovacao: l.dataAprovacao ?? '',
    cep: mascaraCep(l.cep ?? ''),
    endereco: l.endereco ?? '',
    bairro: l.bairro ?? '',
    cidade: l.cidade ?? '',
    uf: l.uf ?? '',
    matriculaMae: l.matriculaMae ?? '',
    areaTotal: l.areaTotal,
    areaLoteavel: l.areaLoteavel,
    centro: l.latitude !== null && l.longitude !== null ? { lat: l.latitude, lng: l.longitude } : null,
    cartorio: l.cartorio ?? '',
    numeroRegistro: l.numeroRegistro ?? '',
    licencaAmbiental: l.licencaAmbiental ?? '',
    validadeLicenca: l.validadeLicenca ?? '',
  }
}

function paraApi({ centro, ...dados }: DadosLoteamento) {
  delete dados.id
  return {
    ...dados,
    nome: dados.nome.trim(),
    codigo: dados.codigo.trim().toUpperCase(),
    latitude: centro?.lat ?? null,
    longitude: centro?.lng ?? null,
  }
}

/** Grava os loteamentos da API no banco local, que as telas ainda não migradas leem. */
export async function sincronizarLoteamentos(signal?: AbortSignal) {
  const loteamentos = (await http<LoteamentoApi[]>('/loteamentos', { signal })).map(paraLoteamento)
  atualizarDb((db) => ({ ...db, loteamentos }))
  return loteamentos
}

export async function salvarLoteamento(dados: DadosLoteamento) {
  // TODO: levar a checagem de duplicidade para a API
  const { loteamentos } = lerDb()
  const codigo = dados.codigo.trim().toUpperCase()
  if (loteamentos.some((l) => l.codigo === codigo && l.id !== dados.id)) {
    throw new Error(`Já existe um loteamento com o código ${codigo}.`)
  }
  if (loteamentos.some((l) => l.nome.toLowerCase() === dados.nome.trim().toLowerCase() && l.id !== dados.id)) {
    throw new Error(`Já existe um loteamento chamado ${dados.nome.trim()}.`)
  }

  const anterior = dados.id ? loteamentos.find((l) => l.id === dados.id) : undefined
  const salvo = paraLoteamento(
    dados.id
      ? await http<LoteamentoApi>(`/loteamentos/${dados.id}`, { method: 'PATCH', body: paraApi(dados) })
      : await http<LoteamentoApi>('/loteamentos', { method: 'POST', body: paraApi(dados) }),
  )

  atualizarDb((db) => {
    const renomeado = anterior && anterior.nome !== salvo.nome
    return {
      ...db,
      loteamentos: anterior ? db.loteamentos.map((l) => (l.id === salvo.id ? salvo : l)) : [...db.loteamentos, salvo],
      // Imóveis e quadras locais ainda referenciam o loteamento pelo nome.
      imoveis: renomeado
        ? db.imoveis.map((i) => (i.loteamento === anterior.nome ? { ...i, loteamento: salvo.nome } : i))
        : db.imoveis,
      quadras: renomeado
        ? db.quadras.map((q) => (q.loteamento === anterior.nome ? { ...q, loteamento: salvo.nome } : q))
        : db.quadras,
    }
  })
  return salvo
}
