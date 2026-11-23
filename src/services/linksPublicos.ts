import type { Db } from '../data/types'
import { http } from './http'

export type Escopo = 'catalogo' | 'loteamento' | 'imovel'

export interface LinkPublico {
  id: string
  token: string
  escopo: Escopo
  alvo: string | null
  expiraEm: string | null
  visitas: number
  criadoEm: string
}

export const listarLinks = () => http<LinkPublico[]>('/links-publicos')

export const criarLink = (escopo: Escopo, alvo: string | null, validadeDias: number | null) =>
  http<LinkPublico>('/links-publicos', { method: 'POST', body: { escopo, alvo: alvo ?? undefined, validadeDias } })

export const abrirLink = (token: string) =>
  http<{ escopo: Escopo; alvo: string | null; valido: boolean }>(`/publico/links/${encodeURIComponent(token)}`)

export const enderecoDoLink = (token: string) => `${window.location.origin}/l/${token}`

/** Página do catálogo para onde o link leva o visitante. */
export function destinoDoLink(db: Pick<Db, 'loteamentos'>, escopo: Escopo, alvo: string | null) {
  if (escopo === 'imovel' && alvo) return `/terrenos/${alvo}`
  if (escopo === 'loteamento') {
    const nome = db.loteamentos.find((l) => l.id === alvo)?.nome
    return nome ? `/terrenos?emp=${encodeURIComponent(nome)}` : '/terrenos'
  }
  return '/terrenos'
}
