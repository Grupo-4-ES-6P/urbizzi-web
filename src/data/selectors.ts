import type { Db, Imovel, Loteamento, Proposta, Reserva, Situacao, VarianteBadge } from './types'

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

export const SITUACAO_EXIBICAO: Record<Situacao, { rotulo: string; variante: VarianteBadge }> = {
  disponivel: { rotulo: 'Disponível', variante: 'normal' },
  reservado: { rotulo: 'Reservado', variante: 'atencao' },
  vendido: { rotulo: 'Vendido', variante: 'laranja' },
  bloqueado: { rotulo: 'Bloqueado', variante: 'escuro' },
}

/** Situação mostrada nas listas: proposta pendente aparece como "Em aprovação". */
export function situacaoExibida(imovel: Imovel, propostasPendentes: Set<string>) {
  if (imovel.status === 'rascunho') return { rotulo: 'Rascunho', variante: 'rascunho' as VarianteBadge }
  if (propostasPendentes.has(imovel.id) && imovel.situacao !== 'vendido') {
    return { rotulo: 'Em aprovação', variante: 'escuro' as VarianteBadge }
  }
  return SITUACAO_EXIBICAO[imovel.situacao]
}

export function imoveisComPropostaPendente(db: Db) {
  return new Set(db.propostas.filter((p) => p.status === 'pendente').map((p) => p.imovelId))
}

/** Identificador completo do lote: <código do loteamento>-<quadra>-<lote>, ex.: UNI-I-04-12. */
export function identificadorLote(imovel: Imovel, loteamentos: Loteamento[]) {
  const prefixo = loteamentos.find((l) => l.nome === imovel.loteamento)?.codigo
  return [prefixo, imovel.endereco.quadra, imovel.endereco.lote].filter(Boolean).join('-')
}

/** Imóvel aparece no catálogo público (RF31: vendidos e bloqueados não aparecem). */
export function visivelNoCatalogo(imovel: Imovel) {
  return (
    imovel.status === 'publicado' &&
    imovel.publicacao.catalogo &&
    (imovel.situacao === 'disponivel' || imovel.situacao === 'reservado')
  )
}

export function contarPor<T>(lista: T[], chave: (x: T) => string) {
  const mapa = new Map<string, number>()
  for (const x of lista) mapa.set(chave(x), (mapa.get(chave(x)) ?? 0) + 1)
  return mapa
}

export interface ResumoQuadra {
  id: string
  identificacao: string
  lotes: number
  disponiveis: number
  reservados: number
  vendidos: number
  areaMedia: number | null
  precoMin: number | null
  precoMax: number | null
  situacao: { rotulo: string; variante: VarianteBadge }
}

/** Números de cada quadra de um loteamento, calculados a partir dos lotes. */
export function resumoQuadras(db: Db, loteamento: string): ResumoQuadra[] {
  return db.quadras
    .filter((q) => q.loteamento === loteamento)
    .map((q) => {
      const lotes = db.imoveis.filter((i) => i.loteamento === loteamento && i.endereco.quadra === q.identificacao)
      const conta = (s: Situacao) => lotes.filter((i) => i.situacao === s).length
      const areas = lotes.map((i) => i.dimensoes.areaTotal).filter((a): a is number => !!a)
      const precos = lotes.map((i) => i.valores.tabela).filter((v): v is number => !!v)
      const vendidos = conta('vendido')
      const situacao =
        lotes.length > 0 && vendidos === lotes.length
          ? { rotulo: 'Esgotada', variante: 'escuro' as VarianteBadge }
          : lotes.some((i) => !i.matricula)
            ? { rotulo: 'Em registro', variante: 'atencao' as VarianteBadge }
            : { rotulo: 'Ativa', variante: 'normal' as VarianteBadge }
      return {
        id: q.id,
        identificacao: q.identificacao,
        lotes: lotes.length,
        disponiveis: conta('disponivel'),
        reservados: conta('reservado'),
        vendidos,
        areaMedia: areas.length ? Math.round(areas.reduce((s, a) => s + a, 0) / areas.length) : null,
        precoMin: precos.length ? Math.min(...precos) : null,
        precoMax: precos.length ? Math.max(...precos) : null,
        situacao,
      }
    })
    .sort((a, b) => a.identificacao.localeCompare(b.identificacao))
}
