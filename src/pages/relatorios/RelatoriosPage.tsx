import { Plus } from 'lucide-react'

import { Kpi } from '../../components/Kpi'
import { Badge } from '../../components/ui'
import { useToast } from '../../contexts/ToastContext'
import { formatarData } from '../../lib/reservas'
import {
  DIAS_DISPONIVEL,
  INDICADORES_RELATORIO,
  RELATORIOS_GERADOS,
  STATUS_RELATORIO,
  type RelatorioGerado,
} from './relatorios'

export function RelatoriosPage() {
  const notificar = useToast()

  // TODO: definir o fluxo de agendamento (provavelmente um modal com relatório, frequência e destinatários).
  const agendarEnvio = () => notificar('Agendamento de envio em breve.', 'info')

  // TODO: definir o fluxo de geração (provavelmente um modal com tipo de relatório, período e formato).
  const gerarRelatorio = () => notificar('Geração de relatórios em breve.', 'info')

  // TODO: baixar o arquivo do relatório quando houver API.
  const abrirRelatorio = (r: RelatorioGerado) => notificar(`Download de "${r.nome}" (${r.formato}) em breve.`, 'info')

  return (
    <>
      <header className="cabecalho">
        <div>
          <h1 className="cabecalho__titulo">Relatórios</h1>
          <p className="cabecalho__subtitulo">Histórico consolidado do período · exportação em CSV e PDF</p>
        </div>
        <div className="cabecalho__acoes">
          <button type="button" className="btn btn--secundario" onClick={agendarEnvio}>
            Agendar envio
          </button>
          <button type="button" className="btn btn--primario" onClick={gerarRelatorio}>
            <Plus size={16} aria-hidden /> Gerar relatório
          </button>
        </div>
      </header>

      <main className="conteudo">
        <section className="kpis" aria-label="Indicadores do período">
          {INDICADORES_RELATORIO.map((i) => (
            <Kpi key={i.titulo} titulo={i.titulo} valor={i.valor} detalhe={i.detalhe} tom={i.tom} />
          ))}
        </section>

        <section className="card" aria-labelledby="titulo-relatorios">
          <div className="card__cabecalho">
            <div>
              <h2 id="titulo-relatorios" className="card__titulo">
                Relatórios gerados
              </h2>
              <p className="card__subtitulo">Arquivos ficam disponíveis por {DIAS_DISPONIVEL} dias</p>
            </div>
          </div>
          {RELATORIOS_GERADOS.length === 0 ? (
            <p className="card__vazio">Nenhum relatório gerado ainda.</p>
          ) : (
            <div className="tabela-wrap">
              <table className="tabela">
                <thead>
                  <tr>
                    <th scope="col">Relatório</th>
                    <th scope="col">Período</th>
                    <th scope="col">Formato</th>
                    <th scope="col">Gerado por</th>
                    <th scope="col">Data</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {RELATORIOS_GERADOS.map((r) => {
                    const s = STATUS_RELATORIO[r.status]
                    const pronto = r.status === 'pronto'
                    return (
                      // Só relatórios prontos têm arquivo para abrir.
                      <tr
                        key={r.id}
                        className={pronto ? 'relatorio--clicavel' : undefined}
                        onClick={pronto ? () => abrirRelatorio(r) : undefined}
                      >
                        <td className="tabela__destaque">
                          {pronto ? (
                            <button
                              type="button"
                              className="relatorio__nome"
                              aria-label={`${r.nome} — baixar ${r.formato}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                abrirRelatorio(r)
                              }}
                            >
                              {r.nome}
                            </button>
                          ) : (
                            r.nome
                          )}
                        </td>
                        <td>{r.periodo}</td>
                        <td>{r.formato}</td>
                        <td>{r.geradoPor}</td>
                        <td>
                          <time dateTime={r.geradoEm}>{formatarData(r.geradoEm)}</time>
                        </td>
                        <td>
                          <Badge variante={s.variante}>{s.rotulo}</Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  )
}
