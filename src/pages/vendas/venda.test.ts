import { lerDb } from '../../data/db'
import type { Venda } from '../../data/types'
import { BOM } from '../../lib/csv'
import { compararPorData } from '../../lib/vendas'
import { gerarCsvVendas, montarLinhas, nomeArquivoVendas, type LinhaVenda } from './venda'

const linhaFalsa = (parcial: Partial<LinhaVenda>, venda: Partial<Venda> = {}): LinhaVenda => ({
  venda: {
    id: 'v',
    codigo: 'VD-2026-0001',
    imovelId: 'i',
    clienteId: 'c',
    corretorId: 'r',
    valor: 176_500,
    data: new Date(2026, 6, 22, 12).toISOString(),
    status: 'concluida',
    historico: [],
    ...venda,
  },
  imovel: undefined,
  cliente: undefined,
  corretor: undefined,
  imovelRotulo: 'Lote 08 — Qd. 03',
  clienteNome: 'Priscila Damo',
  corretorNome: 'Arthur Pacheco',
  ...parcial,
})

describe('CSV de vendas', () => {
  it('começa com BOM, separa por ";" e usa as colunas e formatos pt-BR da tabela', () => {
    const csv = gerarCsvVendas([linhaFalsa({})])
    expect(csv.startsWith(BOM)).toBe(true)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    const [cabecalho, linha, ...resto] = csv.slice(1).split('\r\n')
    expect(cabecalho).toBe('Imóvel;Comprador;Corretor;Valor da venda;Data;Status')
    expect(linha.split(';')).toEqual(['Lote 08 — Qd. 03', 'Priscila Damo', 'Arthur Pacheco', 'R$\u00a0176.500', '22/07/2026', 'Concluída'])
    expect(resto).toEqual([])
  })

  it('neutraliza células que viram fórmula no Excel (=, +, -, @)', () => {
    const csv = gerarCsvVendas([
      linhaFalsa({ clienteNome: '=HYPERLINK("http://mal.example","x")', corretorNome: '+55 45', imovelRotulo: '-2+3' }),
      linhaFalsa({ clienteNome: '@SUM(A1)' }),
    ])
    const [, primeira, segunda] = csv.slice(1).split('\r\n')
    // Aspas internas forçam a célula entre aspas; o apóstrofo vem antes do "=".
    expect(primeira).toBe(`'-2+3;"'=HYPERLINK(""http://mal.example"",""x"")";'+55 45;R$\u00a0176.500;22/07/2026;Concluída`)
    expect(segunda.split(';')[1]).toBe(`'@SUM(A1)`)
  })

  it('protege o separador dentro do texto com aspas', () => {
    const csv = gerarCsvVendas([linhaFalsa({ clienteNome: 'Costa; Silva' })])
    expect(csv.split('\r\n')[1].split(';').slice(0, 3)).toEqual(['Lote 08 — Qd. 03', '"Costa', ' Silva"'])
  })

  it('exporta todas as vendas na ordem da tela', () => {
    const db = lerDb()
    const csv = gerarCsvVendas(montarLinhas(db, [...db.vendas].sort(compararPorData)))
    const linhas = csv.slice(1).split('\r\n')
    expect(linhas).toHaveLength(18)
    expect(linhas[1]).toBe(`Lote 03 — Qd. 07 · Jd. Europa;Silvana Costa;Gabriela Krüger;R$\u00a0268.000;12/08/2026;Concluída`)
    expect(linhas[5]).toContain(';Cancelada')
  })

  it('nomeia o arquivo com a data local', () => {
    expect(nomeArquivoVendas(new Date(2026, 9, 2, 23, 30))).toBe('vendas-2026-10-02.csv')
  })
})
