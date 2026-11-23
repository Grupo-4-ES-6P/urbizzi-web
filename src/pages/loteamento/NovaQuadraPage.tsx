import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { InputNumerico } from '../../components/InputNumerico'
import { Campo, Spinner } from '../../components/ui'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useDb } from '../../data/db'
import type { Situacao } from '../../data/types'
import { formatarDecimal, formatarMoedaInteira } from '../../lib/format'
import { gerarQuadra, type LotePrevia } from '../../services/api'

const MAX_LOTES = 60
const pad = (n: number) => String(n).padStart(2, '0')

/** Ajustes feitos lote a lote na prévia, indexados pelo número do lote. */
type Ajustes = Record<string, Partial<LotePrevia>>

export function NovaQuadraPage() {
  const { id } = useParams()
  const db = useDb()
  const navigate = useNavigate()
  const notificar = useToast()
  const { usuario } = useAuth()
  const loteamentoRota = db.loteamentos.find((l) => l.id === id)

  const [loteamento, setLoteamento] = useState(loteamentoRota?.nome ?? db.loteamentos[0]?.nome ?? '')
  const quadrasExistentes = db.quadras.filter((q) => q.loteamento === loteamento).map((q) => q.identificacao)
  const sugestao = pad(quadrasExistentes.reduce((m, q) => Math.max(m, Number(q) || 0), 0) + 1)
  const [identificacao, setIdentificacao] = useState('')
  const [area, setArea] = useState<number | null>(null)
  const [testadaPara, setTestadaPara] = useState('')
  const [quantidade, setQuantidade] = useState(12)
  const [inicial, setInicial] = useState(1)
  const [areaPadrao, setAreaPadrao] = useState<number | null>(420)
  const [testadaPadrao, setTestadaPadrao] = useState<number | null>(14)
  const [valorPadrao, setValorPadrao] = useState<number | null>(178000)
  const [situacaoInicial, setSituacaoInicial] = useState<Situacao>('disponivel')
  const [ajustes, setAjustes] = useState<Ajustes>({})
  const [erros, setErros] = useState<Record<string, string>>({})
  const [gerando, setGerando] = useState(false)

  const qd = (identificacao.trim() || sugestao).replace(/^qd\.?\s*/i, '').padStart(2, '0')

  const previa = useMemo<LotePrevia[]>(
    () =>
      Array.from({ length: Math.min(Math.max(quantidade, 0), MAX_LOTES) }, (_, i) => {
        const lote = pad(inicial + i)
        return {
          lote,
          area: areaPadrao ?? 0,
          testada: testadaPadrao ?? 0,
          valor: valorPadrao ?? 0,
          situacao: situacaoInicial,
          observacao: '',
          ...ajustes[lote],
        }
      }),
    [quantidade, inicial, areaPadrao, testadaPadrao, valorPadrao, situacaoInicial, ajustes],
  )

  const somaAreas = previa.reduce((s, l) => s + l.area, 0)
  const ajustar = (lote: string, parcial: Partial<LotePrevia>) =>
    setAjustes((a) => ({ ...a, [lote]: { ...a[lote], ...parcial } }))

  const validar = () => {
    const e: Record<string, string> = {}
    if (!loteamento) e.loteamento = 'Escolha o loteamento.'
    if (quadrasExistentes.includes(qd)) e.identificacao = `A Qd. ${qd} já existe neste loteamento.`
    if (!testadaPara.trim()) e.testadaPara = 'Informe a rua de frente.'
    if (quantidade < 1 || quantidade > MAX_LOTES) e.quantidade = `Entre 1 e ${MAX_LOTES}.`
    if (inicial < 1) e.inicial = 'Comece em 1 ou mais.'
    if (!areaPadrao) e.areaPadrao = 'Informe a área.'
    if (!valorPadrao) e.valorPadrao = 'Informe o valor.'
    if (area && somaAreas > area) e.area = `A soma dos lotes (${formatarDecimal(somaAreas)} m²) passa da área da quadra.`
    if (previa.some((l) => !l.area || !l.valor)) e.previa = 'Todos os lotes precisam de área e valor.'
    setErros(e)
    return Object.keys(e).length === 0
  }

  const gerar = async () => {
    if (!validar()) {
      notificar('Revise os campos destacados.', 'erro')
      return
    }
    setGerando(true)
    try {
      const n = await gerarQuadra({ loteamento, identificacao: qd, area, testadaPara: testadaPara.trim() }, previa, usuario?.nome ?? 'Administrador')
      notificar(`Qd. ${qd} criada com ${n} lotes. Eles já aparecem na listagem de imóveis.`)
      navigate(`/imoveis?loteamento=${encodeURIComponent(loteamento)}&quadra=${qd}`)
    } catch (err) {
      notificar(err instanceof Error ? err.message : 'Não foi possível gerar os lotes.', 'erro')
      setGerando(false)
    }
  }

  const voltar = loteamentoRota ? `/imoveis/loteamentos/${loteamentoRota.id}` : '/imoveis/loteamentos'

  return (
    <>
      <header className="cabecalho cabecalho--fixo">
        <div>
          <nav className="migalhas" aria-label="Você está em">
            <Link to="/imoveis">Imóveis</Link>
            <span aria-hidden>›</span>
            <Link to={voltar}>{loteamento || 'Loteamentos'}</Link>
            <span aria-hidden>›</span>
            <span>Nova quadra</span>
          </nav>
          <h1 className="cabecalho__titulo">Nova quadra — {loteamento}</h1>
          <p className="cabecalho__subtitulo">Cria a quadra e gera os lotes em série · RF04 e RF05</p>
        </div>
        <div className="cabecalho__acoes">
          <button type="button" className="btn btn--secundario" onClick={() => navigate(voltar)}>
            Cancelar
          </button>
          <button type="button" className="btn btn--primario" onClick={gerar} disabled={gerando}>
            {gerando && <Spinner />} Gerar {previa.length} {previa.length === 1 ? 'lote' : 'lotes'}
          </button>
        </div>
      </header>

      <main className="conteudo pilha">
        <section className="card secao">
          <div className="secao__cabecalho">
            <h2 className="card__titulo">Dados da quadra</h2>
            <p className="card__subtitulo">A quadra pertence a um loteamento já cadastrado.</p>
          </div>
          <div className="grade">
            <Campo rotulo="Loteamento" erro={erros.loteamento} className="c-3">
              {(p) => (
                <select {...p} className="input select" value={loteamento} onChange={(e) => setLoteamento(e.target.value)}>
                  {db.loteamentos.map((l) => <option key={l.id}>{l.nome}</option>)}
                </select>
              )}
            </Campo>
            <Campo rotulo="Identificação da quadra" erro={erros.identificacao} dica={identificacao ? undefined : `Sugestão: Qd. ${sugestao}`} className="c-3">
              {(p) => <input {...p} className="input" placeholder={`Qd. ${sugestao}`} value={identificacao} onChange={(e) => setIdentificacao(e.target.value)} />}
            </Campo>
            <Campo rotulo="Área da quadra" erro={erros.area} className="c-3">
              {(p) => <InputNumerico {...p} sufixo="m²" valor={area} onChange={setArea} />}
            </Campo>
            <Campo rotulo="Testada para" erro={erros.testadaPara} className="c-3">
              {(p) => <input {...p} className="input" placeholder="Rua Guaraní" value={testadaPara} onChange={(e) => setTestadaPara(e.target.value)} />}
            </Campo>
          </div>
        </section>

        <section className="card secao">
          <div className="secao__cabecalho">
            <h2 className="card__titulo">Geração de lotes em série</h2>
            <p className="card__subtitulo">Os lotes são criados de uma vez e podem ser ajustados na prévia ou editados depois.</p>
          </div>
          <div className="grade">
            <Campo rotulo="Quantidade de lotes" erro={erros.quantidade} className="c-2">
              {(p) => <input {...p} type="number" min={1} max={MAX_LOTES} className="input" value={quantidade} onChange={(e) => setQuantidade(Number(e.target.value))} />}
            </Campo>
            <Campo rotulo="Numeração inicial" erro={erros.inicial} className="c-2">
              {(p) => <input {...p} type="number" min={1} className="input" value={inicial} onChange={(e) => setInicial(Number(e.target.value))} />}
            </Campo>
            <Campo rotulo="Área padrão" erro={erros.areaPadrao} className="c-2">
              {(p) => <InputNumerico {...p} sufixo="m²" valor={areaPadrao} onChange={setAreaPadrao} />}
            </Campo>
            <Campo rotulo="Testada padrão" className="c-2">
              {(p) => <InputNumerico {...p} sufixo="m" valor={testadaPadrao} onChange={setTestadaPadrao} />}
            </Campo>
            <Campo rotulo="Valor de tabela padrão" erro={erros.valorPadrao} className="c-2">
              {(p) => <InputNumerico {...p} prefixo="R$" valor={valorPadrao} onChange={setValorPadrao} />}
            </Campo>
            <Campo rotulo="Situação inicial" className="c-2">
              {(p) => (
                <select {...p} className="input select" value={situacaoInicial} onChange={(e) => setSituacaoInicial(e.target.value as Situacao)}>
                  <option value="disponivel">Disponível</option>
                  <option value="bloqueado">Bloqueado</option>
                </select>
              )}
            </Campo>
          </div>
          <p className="nota-regra">RF06 — cada lote recebe matrícula própria; enquanto o registro não sai, fica marcado como pendente e não pode ser vendido.</p>
        </section>

        <section className="card">
          <div className="card__cabecalho">
            <div>
              <h2 className="card__titulo">Prévia dos lotes</h2>
              <p className="card__subtitulo">
                Confira antes de confirmar · {previa.length} lotes, {formatarDecimal(somaAreas)} m² no total
                {area ? ` de ${formatarDecimal(area)} m² da quadra` : ''}
              </p>
            </div>
            {Object.keys(ajustes).length > 0 && (
              <button type="button" className="link" onClick={() => setAjustes({})}>
                Desfazer ajustes
              </button>
            )}
          </div>
          {erros.previa && <p className="campo__erro secao">{erros.previa}</p>}
          <div className="tabela-wrap">
            <table className="tabela tabela--edicao">
              <thead>
                <tr>
                  <th>Lote</th><th>Matrícula</th><th>Área (m²)</th><th>Testada (m)</th><th>Valor de tabela</th><th>Situação</th><th>Observação</th>
                </tr>
              </thead>
              <tbody>
                {previa.map((l) => (
                  <tr key={l.lote}>
                    <td className="tabela__destaque">{qd}-{l.lote}</td>
                    <td><em className="texto-fraco">Pendente</em></td>
                    <td><InputNumerico aria-label={`Área do lote ${l.lote}`} valor={l.area || null} onChange={(v) => ajustar(l.lote, { area: v ?? 0 })} /></td>
                    <td><InputNumerico aria-label={`Testada do lote ${l.lote}`} valor={l.testada || null} onChange={(v) => ajustar(l.lote, { testada: v ?? 0 })} /></td>
                    <td><InputNumerico aria-label={`Valor do lote ${l.lote}`} prefixo="R$" valor={l.valor || null} onChange={(v) => ajustar(l.lote, { valor: v ?? 0 })} /></td>
                    <td>
                      <select
                        className="input select input--compacto"
                        aria-label={`Situação do lote ${l.lote}`}
                        value={l.situacao}
                        onChange={(e) => ajustar(l.lote, { situacao: e.target.value as Situacao })}
                      >
                        <option value="disponivel">Disponível</option>
                        <option value="bloqueado">Bloqueado</option>
                      </select>
                    </td>
                    <td>
                      <input
                        className="input input--compacto"
                        aria-label={`Observação do lote ${l.lote}`}
                        placeholder="—"
                        value={l.observacao}
                        onChange={(e) => ajustar(l.lote, { observacao: e.target.value })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="paginacao">
            <span>Valor total de tabela: {formatarMoedaInteira(previa.reduce((s, l) => s + l.valor, 0))}</span>
          </p>
        </section>
      </main>
    </>
  )
}
