import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Dialogo } from '../../components/Dialogo'
import { InputNumerico } from '../../components/InputNumerico'
import { Badge, Campo } from '../../components/ui'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useDb } from '../../data/db'
import type { Db, Proposta } from '../../data/types'
import { formatarData, formatarMoedaInteira } from '../../lib/format'
import { registrarContraproposta } from '../../services/propostas'

interface Versao {
  numero: number
  valor: number
  condicao?: string
  data: string
  autor: string
}

const DIA = 24 * 60 * 60 * 1000

const SITUACAO_PROPOSTA: Record<Proposta['status'], { rotulo: string; variante: string }> = {
  rascunho: { rotulo: 'Rascunho', variante: 'rascunho' },
  pendente: { rotulo: 'Em análise', variante: 'escuro' },
  aprovada: { rotulo: 'Aprovada', variante: 'normal' },
  recusada: { rotulo: 'Recusada', variante: 'critico' },
}

function nomeResponsavel(db: Db, id: string) {
  return [...db.corretores, ...db.usuarios].find((p) => p.id === id)?.nome ?? 'Sistema'
}

/**
 * Monta a linha do tempo de versões. Cada item de `proposta.versoes` guarda a
 * versão que foi substituída e quem a substituiu; a última é a proposta atual.
 */
function montarVersoes(proposta: Proposta, autorInicial: string): Versao[] {
  const anteriores = [...(proposta.versoes ?? [])].sort((a, b) => a.numero - b.numero)
  return [...anteriores, null].map((v, i) => {
    const substituida = i > 0 ? anteriores[i - 1] : undefined
    return {
      numero: v?.numero ?? proposta.versao ?? anteriores.length + 1,
      valor: v?.valor ?? proposta.valor,
      condicao: v ? v.condicao : proposta.condicao,
      data: substituida?.registradaEm ?? proposta.criadaEm,
      autor: substituida?.autor ?? autorInicial,
    }
  })
}

function oQueMudou(versao: Versao, anterior: Versao | undefined) {
  if (!anterior) return 'Versão inicial da proposta'
  const mudancas: string[] = []
  if (versao.valor !== anterior.valor) {
    const variacao = ((versao.valor - anterior.valor) / anterior.valor) * 100
    const sinal = variacao > 0 ? '+' : ''
    mudancas.push(`Valor ${sinal}${variacao.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`)
  }
  if ((versao.condicao ?? '') !== (anterior.condicao ?? '')) {
    mudancas.push(`Condição: ${anterior.condicao || '—'} → ${versao.condicao || '—'}`)
  }
  return mudancas.length ? mudancas.join(' · ') : 'Sem alteração de valores'
}

interface Evento {
  id: string
  data: string
  evento: string
  responsavel: string
  detalhe: string
  situacao: { rotulo: string; variante: string }
}

function eventosDaProposta(db: Db, proposta: Proposta, agora: number): Evento[] {
  const registrados: Evento[] = db.historico
    .filter((e) => e.referencia === proposta.codigo || e.descricao.includes(proposta.codigo))
    .map((e) => ({ id: e.id, data: e.data, evento: e.tipo, responsavel: e.autor, detalhe: e.descricao, situacao: e.situacao }))

  const prazos: Evento[] = []
  if (proposta.status === 'pendente' && proposta.expiraEm) {
    const fim = new Date(proposta.expiraEm).getTime()
    const aviso = fim - 3 * DIA
    if (aviso > agora) {
      prazos.push({
        id: 'aviso-prazo', data: new Date(aviso).toISOString(), evento: 'Aviso de prazo', responsavel: 'Sistema',
        detalhe: 'Faltam 3 dias para a proposta expirar', situacao: { rotulo: 'Atenção', variante: 'atencao' },
      })
    }
    prazos.push({
      id: 'prazo-final', data: proposta.expiraEm, evento: 'Prazo final', responsavel: 'Sistema',
      detalhe: 'Sem decisão até esta data a proposta expira', situacao: { rotulo: 'Previsto', variante: 'neutro' },
    })
  }
  return [...registrados, ...prazos].sort((a, b) => a.data.localeCompare(b.data))
}

export function PropostaVersoesPage() {
  const { id } = useParams()
  const db = useDb()
  const proposta = db.propostas.find((p) => p.id === id || p.codigo === id)
  if (!proposta) {
    return (
      <main className="conteudo">
        <section className="card vazio">
          <h1>Proposta não encontrada</h1>
          <Link to="/dashboard" className="btn btn--secundario">Voltar ao dashboard</Link>
        </section>
      </main>
    )
  }
  return <TelaVersoes key={proposta.id} proposta={proposta} />
}

function TelaVersoes({ proposta }: Readonly<{ proposta: Proposta }>) {
  const db = useDb()
  const { usuario } = useAuth()
  const notificar = useToast()
  const [comparar, setComparar] = useState(false)
  const [novaVersao, setNovaVersao] = useState(false)
  const [valor, setValor] = useState<number | null>(null)
  const [justificativa, setJustificativa] = useState('')
  const [salvando, setSalvando] = useState(false)

  const versoes = montarVersoes(proposta, nomeResponsavel(db, proposta.corretorId))
  const atual = versoes.at(-1)!
  const [versaoA, setVersaoA] = useState(versoes.length > 1 ? versoes.at(-2)!.numero : atual.numero)
  const [versaoB, setVersaoB] = useState(atual.numero)
  const eventos = eventosDaProposta(db, proposta, Date.now())
  const situacao = SITUACAO_PROPOSTA[proposta.status]
  const pendente = proposta.status === 'pendente'

  const abrirNovaVersao = () => {
    setValor(proposta.valor)
    setJustificativa('')
    setNovaVersao(true)
  }

  const registrar = async () => {
    if (!usuario || valor === null) return
    setSalvando(true)
    try {
      await registrarContraproposta(proposta.id, valor, justificativa, usuario)
      notificar(`Versão ${atual.numero + 1} registrada. A anterior foi preservada.`)
      setNovaVersao(false)
    } catch (error_) {
      notificar(error_ instanceof Error ? error_.message : 'Não foi possível registrar a versão.', 'erro')
    } finally {
      setSalvando(false)
    }
  }

  const a = versoes.find((v) => v.numero === versaoA)
  const b = versoes.find((v) => v.numero === versaoB)

  return (
    <>
      <header className="cabecalho">
        <div>
          <nav className="migalhas" aria-label="Você está em">
            <Link to="/propostas">Propostas</Link>
            <span aria-hidden>›</span>
            <Link to={`/propostas/${proposta.id}`}>{proposta.codigo}</Link>
            <span aria-hidden>›</span>
            <span>Versões</span>
          </nav>
          <h1 className="cabecalho__titulo">{proposta.codigo} — Versões</h1>
          <p className="cabecalho__subtitulo">Cada edição gera uma nova versão preservando as condições anteriores · RF18</p>
        </div>
        <div className="cabecalho__acoes">
          <button type="button" className="btn btn--secundario" disabled={versoes.length < 2} onClick={() => setComparar(true)}>
            Comparar versões
          </button>
          <button
            type="button"
            className="btn btn--primario"
            disabled={!pendente}
            title={pendente ? undefined : 'Só propostas em análise recebem novas versões'}
            onClick={abrirNovaVersao}
          >
            Nova versão
          </button>
        </div>
      </header>

      <main className="conteudo pilha">
        <section className="card secao">
          <div className="secao__cabecalho">
            <h2 className="card__titulo">Versão atual — v{atual.numero}</h2>
            <p className="card__subtitulo">É sobre a versão que o gestor está analisando.</p>
          </div>
          <dl className="versao-atual">
            <div><dt>Valor proposto</dt><dd>{formatarMoedaInteira(atual.valor)}</dd></div>
            <div><dt>Entrada</dt><dd>{proposta.entrada === undefined ? '—' : formatarMoedaInteira(proposta.entrada)}</dd></div>
            <div><dt>Condição</dt><dd>{proposta.parcelas ? `${proposta.parcelas}x` : atual.condicao || '—'}</dd></div>
            <div><dt>Validade</dt><dd>{proposta.expiraEm ? formatarData(proposta.expiraEm) : '—'}</dd></div>
            <div><dt>Situação</dt><dd>{situacao.rotulo}</dd></div>
            <div><dt>Autor</dt><dd>{atual.autor}</dd></div>
          </dl>
          <p className="nota-regra">RF18 — versões anteriores ficam somente leitura; nada é sobrescrito.</p>
        </section>

        <section className="card">
          <div className="card__cabecalho">
            <div>
              <h2 className="card__titulo">Histórico de versões</h2>
              <p className="card__subtitulo">Autor, data e o que mudou em cada versão.</p>
            </div>
          </div>
          <div className="tabela-wrap">
            <table className="tabela">
              <thead>
                <tr><th>Versão</th><th>Data</th><th>Autor</th><th>O que mudou</th><th>Valor</th><th>Situação</th></tr>
              </thead>
              <tbody>
                {[...versoes].reverse().map((v) => {
                  const anterior = versoes.find((x) => x.numero === v.numero - 1)
                  const vigente = v.numero === atual.numero
                  return (
                    <tr key={v.numero}>
                      <td className="tabela__destaque">v{v.numero}</td>
                      <td>{formatarData(v.data)}</td>
                      <td>{v.autor}</td>
                      <td>{oQueMudou(v, anterior)}</td>
                      <td>{formatarMoedaInteira(v.valor)}</td>
                      <td>
                        <Badge variante={vigente ? situacao.variante : 'neutro'}>{vigente ? situacao.rotulo : 'Substituída'}</Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="card__cabecalho">
            <div>
              <h2 className="card__titulo">Decisões e prazos</h2>
              <p className="card__subtitulo">Trilha de aprovação e controle de validade · RF19, RF20 e RF21.</p>
            </div>
          </div>
          {eventos.length === 0 ? (
            <p className="card__vazio">Nenhuma decisão registrada ainda.</p>
          ) : (
            <div className="tabela-wrap">
              <table className="tabela">
                <thead>
                  <tr><th>Data</th><th>Evento</th><th>Responsável</th><th>Detalhe</th><th>Situação</th></tr>
                </thead>
                <tbody>
                  {eventos.map((e) => (
                    <tr key={e.id}>
                      <td className="tabela__destaque">{formatarData(e.data)}</td>
                      <td>{e.evento}</td>
                      <td>{e.responsavel}</td>
                      <td>{e.detalhe}</td>
                      <td><Badge variante={e.situacao.variante}>{e.situacao.rotulo}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      <Dialogo
        aberto={comparar}
        titulo="Comparar versões"
        textoConfirmar="Fechar"
        semCancelar
        largo
        onConfirmar={() => setComparar(false)}
        onCancelar={() => setComparar(false)}
      >
        <div className="grade">
          <Campo rotulo="Versão A" className="c-6">
            {(p) => (
              <select {...p} className="input select" value={versaoA} onChange={(e) => setVersaoA(Number(e.target.value))}>
                {versoes.map((v) => <option key={v.numero} value={v.numero}>v{v.numero}</option>)}
              </select>
            )}
          </Campo>
          <Campo rotulo="Versão B" className="c-6">
            {(p) => (
              <select {...p} className="input select" value={versaoB} onChange={(e) => setVersaoB(Number(e.target.value))}>
                {versoes.map((v) => <option key={v.numero} value={v.numero}>v{v.numero}</option>)}
              </select>
            )}
          </Campo>
        </div>
        {a && b && (
          <div className="tabela-wrap">
            <table className="tabela">
              <thead>
                <tr><th>Campo</th><th>v{a.numero}</th><th>v{b.numero}</th></tr>
              </thead>
              <tbody>
                <tr><td>Valor</td><td>{formatarMoedaInteira(a.valor)}</td><td>{formatarMoedaInteira(b.valor)}</td></tr>
                <tr><td>Condição</td><td>{a.condicao || '—'}</td><td>{b.condicao || '—'}</td></tr>
                <tr><td>Data</td><td>{formatarData(a.data)}</td><td>{formatarData(b.data)}</td></tr>
                <tr><td>Autor</td><td>{a.autor}</td><td>{b.autor}</td></tr>
              </tbody>
            </table>
          </div>
        )}
      </Dialogo>

      <Dialogo
        aberto={novaVersao}
        titulo={`Registrar versão ${atual.numero + 1}`}
        descricao="A versão atual fica guardada no histórico, somente leitura."
        textoConfirmar="Registrar versão"
        carregando={salvando}
        confirmarDesabilitado={!valor || valor === proposta.valor || !justificativa.trim()}
        onCancelar={() => setNovaVersao(false)}
        onConfirmar={registrar}
      >
        <Campo rotulo="Novo valor">
          {(p) => <InputNumerico {...p} prefixo="R$" valor={valor} onChange={setValor} />}
        </Campo>
        <Campo rotulo="O que mudou">
          {(p) => (
            <textarea
              {...p}
              className="input input--area"
              rows={3}
              value={justificativa}
              placeholder="Ex.: desconto de 3% e entrada reduzida para 20%"
              onChange={(e) => setJustificativa(e.target.value)}
            />
          )}
        </Campo>
      </Dialogo>
    </>
  )
}
