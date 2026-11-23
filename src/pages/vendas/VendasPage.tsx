import { ChevronLeft, ChevronRight, Download, Plus } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { Badge } from '../../components/ui'
import { useDb } from '../../data/db'
import { indexar, rotuloImovel } from '../../data/selectors'
import type { Venda, VarianteBadge } from '../../data/types'
import { formatarMoedaCompacta, formatarMoedaInteira } from '../../lib/format'

const POR_PAGINA = 20

// Marca de ordem de bytes: faz o Excel abrir o CSV como UTF-8.
const BOM = '﻿'

const STATUS_VENDA: Record<Venda['status'], { rotulo: string; variante: VarianteBadge }> = {
  ativa: { rotulo: 'Concluída', variante: 'normal' },
  cancelada: { rotulo: 'Cancelada', variante: 'critico' },
}

interface LinhaVenda {
  venda: Venda
  imovel: string
  comprador: string
  corretor: string
}

const formatarData = (iso: string) => new Date(iso).toLocaleDateString('pt-BR')

function celulaCsv(valor: string) {
  return /[;"\n]/.test(valor) ? `"${valor.replaceAll('"', '""')}"` : valor
}

function exportarCsv(linhas: LinhaVenda[]) {
  const cabecalho = ['Código', 'Imóvel', 'Comprador', 'Corretor', 'Valor da venda', 'Data', 'Status']
  const corpo = linhas.map(({ venda, imovel, comprador, corretor }) =>
    [venda.codigo, imovel, comprador, corretor, String(venda.valor), formatarData(venda.data), STATUS_VENDA[venda.status].rotulo]
      .map(celulaCsv)
      .join(';'),
  )
  const conteudo = `${BOM}${[cabecalho.join(';'), ...corpo].join('\n')}\n`
  const url = URL.createObjectURL(new Blob([conteudo], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'vendas.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function textoVendas(n: number) {
  return n === 1 ? '1 venda registrada' : `${n} vendas registradas`
}

function textoCanceladas(n: number) {
  return n === 1 ? '1 cancelada' : `${n} canceladas`
}

export function VendasPage() {
  const db = useDb()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const pagina = Math.max(1, Number(params.get('pagina')) || 1)

  // Cruza cada venda com o lote, o comprador e o corretor da proposta aprovada.
  const linhas = useMemo<LinhaVenda[]>(() => {
    const imoveis = indexar(db.imoveis)
    const pessoas = indexar([...db.clientes, ...db.corretores, ...db.usuarios])
    const propostas = indexar(db.propostas)
    return [...db.vendas]
      .sort((a, b) => b.data.localeCompare(a.data))
      .map((venda) => {
        const imovel = imoveis.get(venda.imovelId)
        const corretorId = venda.corretorId ?? (venda.propostaId ? propostas.get(venda.propostaId)?.corretorId : undefined)
        return {
          venda,
          imovel: imovel ? rotuloImovel(imovel) : 'Imóvel removido',
          comprador: pessoas.get(venda.clienteId)?.nome ?? '—',
          corretor: (corretorId && pessoas.get(corretorId)?.nome) || '—',
        }
      })
  }, [db.imoveis, db.clientes, db.corretores, db.usuarios, db.propostas, db.vendas])

  const ano = String(new Date().getFullYear())
  const totalAno = db.vendas
    .filter((v) => v.status === 'ativa' && v.data.startsWith(ano))
    .reduce((soma, v) => soma + v.valor, 0)
  const canceladas = db.vendas.filter((v) => v.status === 'cancelada').length

  const totalPaginas = Math.max(1, Math.ceil(linhas.length / POR_PAGINA))
  const paginaAtual = Math.min(pagina, totalPaginas)
  const visiveis = linhas.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA)

  const irPara = (novaPagina: number) => {
    const novo = new URLSearchParams(params)
    novo.set('pagina', String(novaPagina))
    setParams(novo, { replace: true })
  }

  return (
    <>
      <header className="cabecalho">
        <div>
          <h1 className="cabecalho__titulo">Vendas</h1>
          <p className="cabecalho__subtitulo">
            {textoVendas(db.vendas.length)} · {formatarMoedaCompacta(totalAno)} no ano · {textoCanceladas(canceladas)}
          </p>
        </div>
        <div className="cabecalho__acoes">
          <button type="button" className="btn btn--secundario" disabled={linhas.length === 0} onClick={() => exportarCsv(linhas)}>
            <Download size={15} /> Exportar CSV
          </button>
          <Link to="/propostas/nova" className="btn btn--primario">
            <Plus size={16} /> Registrar venda
          </Link>
        </div>
      </header>

      <main className="conteudo">
        <section className="card">
          <div className="card__cabecalho">
            <div>
              <h2 className="card__titulo">Vendas registradas</h2>
              <p className="card__subtitulo">Cancelamentos exigem justificativa e ficam registrados na auditoria</p>
            </div>
          </div>

          {visiveis.length === 0 ? (
            <p className="card__vazio">Nenhuma venda registrada.</p>
          ) : (
            <div className="tabela-wrap">
              <table className="tabela tabela--clicavel">
                <thead>
                  <tr>
                    <th>Imóvel</th>
                    <th>Comprador</th>
                    <th>Corretor</th>
                    <th>Valor da venda</th>
                    <th>Data</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map(({ venda, imovel, comprador, corretor }) => {
                    const status = STATUS_VENDA[venda.status]
                    return (
                      <tr key={venda.id} onClick={() => navigate(`/imoveis/${venda.imovelId}/historico`)}>
                        <td>
                          <Link
                            to={`/imoveis/${venda.imovelId}/historico`}
                            className="tabela__destaque"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {imovel}
                          </Link>
                        </td>
                        <td>{comprador}</td>
                        <td>{corretor}</td>
                        <td>{formatarMoedaInteira(venda.valor)}</td>
                        <td>{formatarData(venda.data)}</td>
                        <td>
                          <Badge variante={status.variante}>{status.rotulo}</Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="paginacao">
            <span>
              {linhas.length === 0
                ? '0 resultados'
                : `${(paginaAtual - 1) * POR_PAGINA + 1}–${Math.min(paginaAtual * POR_PAGINA, linhas.length)} de ${linhas.length}`}
            </span>
            <div>
              <button
                type="button"
                className="btn btn--secundario btn--icone"
                disabled={paginaAtual <= 1}
                onClick={() => irPara(paginaAtual - 1)}
                aria-label="Página anterior"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                className="btn btn--secundario btn--icone"
                disabled={paginaAtual >= totalPaginas}
                onClick={() => irPara(paginaAtual + 1)}
                aria-label="Próxima página"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
