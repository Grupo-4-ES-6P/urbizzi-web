import { indexar, rotuloImovel } from '../../data/selectors'
import type { Cliente, Db, Imovel, Usuario, Proposta, Reserva, SituacaoProposta, VersaoProposta } from '../../data/types'
import { calcularCondicoes, situacaoProposta, versaoAtual, type CalculoProposta } from '../../lib/propostas'

/** Proposta com os cadastros relacionados e a situação efetiva no instante atual. */
export interface LinhaProposta {
  proposta: Proposta
  situacao: SituacaoProposta
  versao: VersaoProposta
  calculo: CalculoProposta
  imovel: Imovel | undefined
  cliente: Cliente | undefined
  corretor: Usuario | undefined
  reserva: Reserva | undefined
  imovelRotulo: string
  clienteNome: string
  corretorNome: string
}

export function montarLinhas(db: Db, propostas: Proposta[], agora: number): LinhaProposta[] {
  const imoveis = indexar(db.imoveis)
  const clientes = indexar(db.clientes)
  const corretores = indexar(db.usuarios)
  const reservas = indexar(db.reservas)
  return propostas.map((proposta) => {
    const imovel = imoveis.get(proposta.imovelId)
    const cliente = clientes.get(proposta.clienteId)
    const corretor = corretores.get(proposta.corretorId)
    const versao = versaoAtual(proposta)
    return {
      proposta,
      situacao: situacaoProposta(proposta, agora),
      versao,
      calculo: calcularCondicoes(versao.condicoes),
      imovel,
      cliente,
      corretor,
      reserva: reservas.get(proposta.reservaId),
      imovelRotulo: imovel ? rotuloImovel(imovel) : 'Imóvel removido',
      clienteNome: cliente?.nome ?? 'Cliente removido',
      corretorNome: corretor?.nome ?? '—',
    }
  })
}

/** Usuários que podem ser escolhidos como aprovador, com o rótulo "Nome — Papel". */
export function aprovadoresDisponiveis(db: Db, papeis: readonly string[]) {
  return db.usuarios
    .filter((u) => papeis.includes(u.papel))
    .map((u) => ({ id: u.id, rotulo: `${u.nome} — ${u.papel}` }))
}

export const dataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
