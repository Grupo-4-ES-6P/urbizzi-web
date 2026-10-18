import { indexar, rotuloImovel } from '../../data/selectors'
import type { Cliente, Db, Imovel, Usuario, Venda } from '../../data/types'
import { gerarCsv } from '../../lib/csv'
import { formatarMoedaInteira } from '../../lib/format'
import { dataCalendario, formatarData } from '../../lib/reservas'
import { STATUS_VENDA } from '../../lib/vendas'

/** Venda com os cadastros relacionados já resolvidos para exibição. */
export interface LinhaVenda {
  venda: Venda
  imovel: Imovel | undefined
  cliente: Cliente | undefined
  corretor: Usuario | undefined
  imovelRotulo: string
  clienteNome: string
  corretorNome: string
}

export function montarLinhas(db: Db, vendas: Venda[]): LinhaVenda[] {
  const imoveis = indexar(db.imoveis)
  const clientes = indexar(db.clientes)
  const corretores = indexar(db.usuarios)
  return vendas.map((venda) => {
    const imovel = imoveis.get(venda.imovelId)
    const cliente = clientes.get(venda.clienteId)
    const corretor = corretores.get(venda.corretorId)
    return {
      venda,
      imovel,
      cliente,
      corretor,
      imovelRotulo: imovel ? rotuloImovel(imovel) : 'Imóvel removido',
      clienteNome: cliente?.nome ?? 'Cliente removido',
      corretorNome: corretor?.nome ?? '—',
    }
  })
}

/** Mesmas colunas e formatos da tabela, para o arquivo bater com o que está na tela. */
export function gerarCsvVendas(linhas: LinhaVenda[]) {
  return gerarCsv(
    ['Imóvel', 'Comprador', 'Corretor', 'Valor da venda', 'Data', 'Status'],
    linhas.map((l) => [
      l.imovelRotulo,
      l.clienteNome,
      l.corretorNome,
      formatarMoedaInteira(l.venda.valor),
      formatarData(l.venda.data),
      STATUS_VENDA[l.venda.status].rotulo,
    ]),
  )
}

export const nomeArquivoVendas = (hoje: Date) => `vendas-${dataCalendario(hoje)}.csv`
