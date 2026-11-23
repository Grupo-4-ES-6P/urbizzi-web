import { rotuloImovel } from '../data/selectors'
import type { Db } from '../data/types'
import { formatarData, formatarMoedaInteira } from './format'

export const TIPOS_RELATORIO = [
  'Vendas por empreendimento',
  'Reservas expiradas',
  'Vendas por corretor',
  'Inventário de imóveis',
  'Propostas recusadas',
  'Auditoria de cancelamentos',
] as const

export type TipoRelatorio = (typeof TIPOS_RELATORIO)[number]

export interface Tabela {
  cabecalho: string[]
  linhas: string[][]
}

const EXPIRADA = 'Prazo de resposta expirado'

/** Monta o relatório com os dados atuais; ano vazio = todo o histórico. */
export function montarRelatorio(db: Db, tipo: TipoRelatorio, ano: number | null): Tabela {
  const noPeriodo = (data?: string) => ano === null || (!!data && new Date(data).getFullYear() === ano)
  const imovel = (id: string) => db.imoveis.find((i) => i.id === id)
  const nomeImovel = (id: string) => {
    const i = imovel(id)
    return i ? rotuloImovel(i) : id
  }
  const nomeCliente = (id: string) => db.clientes.find((c) => c.id === id)?.nome ?? '—'
  const nomePessoa = (id?: string) =>
    [...db.usuarios, ...db.corretores].find((p) => p.id === id)?.nome ?? 'Sem corretor'
  const vendasAtivas = db.vendas.filter((v) => v.status === 'ativa' && noPeriodo(v.data))

  const agrupar = (chave: (v: Db['vendas'][number]) => string) => {
    const grupos = new Map<string, { qtd: number; total: number }>()
    for (const v of vendasAtivas) {
      const g = grupos.get(chave(v)) ?? { qtd: 0, total: 0 }
      grupos.set(chave(v), { qtd: g.qtd + 1, total: g.total + v.valor })
    }
    return [...grupos].sort((a, b) => b[1].total - a[1].total).map(([nome, g]) => [nome, String(g.qtd), formatarMoedaInteira(g.total)])
  }

  switch (tipo) {
    case 'Vendas por empreendimento':
      return { cabecalho: ['Loteamento', 'Vendas', 'Valor total'], linhas: agrupar((v) => imovel(v.imovelId)?.loteamento ?? '—') }
    case 'Vendas por corretor':
      return { cabecalho: ['Corretor', 'Vendas', 'Valor total'], linhas: agrupar((v) => nomePessoa(v.corretorId)) }
    case 'Reservas expiradas':
      return {
        cabecalho: ['Proposta', 'Imóvel', 'Cliente', 'Prazo'],
        linhas: db.propostas
          .filter((p) => p.status === 'recusada' && p.motivoRecusa === EXPIRADA && noPeriodo(p.expiraEm))
          .map((p) => [p.codigo, nomeImovel(p.imovelId), nomeCliente(p.clienteId), p.expiraEm ? formatarData(p.expiraEm) : '—']),
      }
    case 'Propostas recusadas':
      return {
        cabecalho: ['Proposta', 'Imóvel', 'Cliente', 'Valor', 'Motivo', 'Data'],
        linhas: db.propostas
          .filter((p) => p.status === 'recusada' && noPeriodo(p.decididaEm ?? p.criadaEm))
          .map((p) => [
            p.codigo,
            nomeImovel(p.imovelId),
            nomeCliente(p.clienteId),
            formatarMoedaInteira(p.valor),
            p.motivoRecusa ?? '—',
            formatarData(p.decididaEm ?? p.criadaEm),
          ]),
      }
    case 'Auditoria de cancelamentos':
      return {
        cabecalho: ['Venda', 'Imóvel', 'Cliente', 'Valor', 'Motivo', 'Cancelada em'],
        linhas: db.vendas
          .filter((v) => v.status === 'cancelada' && noPeriodo(v.cancelamento?.em ?? v.data))
          .map((v) => [
            v.codigo,
            nomeImovel(v.imovelId),
            nomeCliente(v.clienteId),
            formatarMoedaInteira(v.valor),
            v.cancelamento?.motivo ?? '—',
            formatarData(v.cancelamento?.em ?? v.data),
          ]),
      }
    case 'Inventário de imóveis':
      return {
        cabecalho: ['Imóvel', 'Matrícula', 'Loteamento', 'Área (m²)', 'Valor de tabela', 'Situação'],
        linhas: db.imoveis.map((i) => [
          rotuloImovel(i),
          i.matricula ?? '',
          i.loteamento,
          String(i.dimensoes?.areaTotal ?? ''),
          i.valores.tabela ? formatarMoedaInteira(i.valores.tabela) : '—',
          i.situacao,
        ]),
      }
  }
}

const escapar = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

/** "PDF": abre a tabela pronta para imprimir ou salvar como PDF pelo navegador. */
export function imprimirTabela(titulo: string, subtitulo: string, { cabecalho, linhas }: Tabela) {
  const janela = window.open('', '_blank')
  if (!janela) throw new Error('O navegador bloqueou a janela de impressão. Libere pop-ups e tente de novo.')
  const th = cabecalho.map((c) => `<th>${escapar(c)}</th>`).join('')
  const tr = linhas.map((l) => `<tr>${l.map((c) => `<td>${escapar(c)}</td>`).join('')}</tr>`).join('')
  janela.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapar(titulo)}</title>
<style>body{font:13px system-ui,sans-serif;margin:32px;color:#16161a}h1{font-size:20px;margin:0}p{color:#62626a;margin:4px 0 20px}
table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #e6e6e2;padding:6px 8px;text-align:left}th{background:#f7f7f5}</style>
</head><body><h1>Urbizzi — ${escapar(titulo)}</h1><p>${escapar(subtitulo)}</p>
<table><thead><tr>${th}</tr></thead><tbody>${tr || `<tr><td colspan="${cabecalho.length}">Sem registros no período.</td></tr>`}</tbody></table>
<script>window.onload=()=>window.print()</script></body></html>`)
  janela.document.close()
}
