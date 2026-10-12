import { indexar, rotuloImovel } from '../../data/selectors'
import type { Cliente, Db, Imovel, Pessoa, Reserva, SituacaoReserva } from '../../data/types'
import { classificarReserva } from '../../lib/reservas'

/** Reserva com os cadastros relacionados e a situação calculada para o instante atual. */
export interface LinhaReserva {
  reserva: Reserva
  situacao: SituacaoReserva
  restante: number
  imovel: Imovel | undefined
  cliente: Cliente | undefined
  corretor: Pessoa | undefined
  imovelRotulo: string
  clienteNome: string
  corretorNome: string
}

export function montarLinhas(db: Db, reservas: Reserva[], agora: number): LinhaReserva[] {
  const imoveis = indexar(db.imoveis)
  const clientes = indexar(db.clientes)
  const corretores = indexar(db.corretores)
  return reservas.map((reserva) => {
    const imovel = imoveis.get(reserva.imovelId)
    const cliente = clientes.get(reserva.clienteId)
    const corretor = corretores.get(reserva.corretorId)
    return {
      reserva,
      situacao: classificarReserva(reserva, agora),
      restante: new Date(reserva.expiraEm).getTime() - agora,
      imovel,
      cliente,
      corretor,
      imovelRotulo: imovel ? rotuloImovel(imovel) : 'Imóvel removido',
      clienteNome: cliente?.nome ?? 'Cliente removido',
      corretorNome: corretor?.nome ?? '—',
    }
  })
}
