import type { Db, Imovel, Proposta, Reserva } from './types'

export function rotuloImovel(imovel: Imovel, comLoteamento = true) {
  const { lote, quadra } = imovel.endereco
  if (!lote) return imovel.titulo || 'Imóvel sem identificação'
  const base = quadra ? `Lote ${lote} — Qd. ${quadra}` : `Lote ${lote}`
  if (!comLoteamento || !imovel.loteamento) return base
  return quadra ? `${base} · ${imovel.loteamento}` : `${base} — ${imovel.loteamento}`
}

export function indexar<T extends { id: string }>(lista: T[]) {
  return new Map(lista.map((x) => [x.id, x]))
}

export function reservaAtiva(r: Reserva, agora: number) {
  return r.status === 'ativa' && new Date(r.expiraEm).getTime() > agora
}

/** Propostas abaixo do valor de tabela precisam do aval do administrador. */
export function exigeAprovacao(p: Proposta, imovel: Imovel | undefined) {
  return p.status === 'pendente' && !!imovel?.valores.tabela && p.valor < imovel.valores.tabela
}

export function descontoSobreTabela(p: Proposta, imovel: Imovel | undefined) {
  const tabela = imovel?.valores.tabela
  if (!tabela) return 0
  return Math.round(((tabela - p.valor) / tabela) * 100)
}

export function proximoCodigo(db: Db) {
  const maior = db.imoveis.reduce((m, i) => Math.max(m, Number(i.codigo) || 0), 0)
  return String(maior + 1)
}

export function resumoGeral(db: Db, agora: number) {
  const ano = new Date(agora).getFullYear()
  return {
    imoveisCadastrados: db.imoveis.filter((i) => i.status === 'publicado').length,
    reservasAtivas: db.reservas.filter((r) => reservaAtiva(r, agora)).length,
    vendasNoAno: db.vendas
      .filter((v) => new Date(v.data).getFullYear() === ano)
      .reduce((s, v) => s + v.valor, 0),
  }
}
