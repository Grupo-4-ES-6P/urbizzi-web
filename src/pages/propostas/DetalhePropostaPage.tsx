import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Dialogo } from '../../components/Dialogo'
import { InputNumerico } from '../../components/InputNumerico'
import { Campo, Spinner } from '../../components/ui'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useDb } from '../../data/db'
import { nomeLote } from '../../data/selectors'
import type { Proposta } from '../../data/types'
import { formatarDecimal, formatarMoedaInteira } from '../../lib/format'
import { aprovarProposta, recusarProposta } from '../../services/api'
import { registrarContraproposta } from '../../services/propostas'

type Acao = 'aprovar' | 'recusar' | 'contraproposta'
type EstadoEtapa = 'concluida' | 'atual' | 'futura' | 'recusada'

function dataHora(valor: string) {
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return 'Data indisponível'
  return data.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function dataSimples(valor?: string) {
  if (!valor) return '—'
  const data = new Date(`${valor}T12:00:00`)
  if (Number.isNaN(data.getTime())) return '—'
  return data.toLocaleDateString('pt-BR')
}

function rotuloSituacao(proposta: Proposta, abaixoDaTabela: boolean) {
  if (proposta.status === 'rascunho') return 'Rascunho'
  if (proposta.status === 'aprovada') return 'Aprovada'
  if (proposta.status === 'recusada') return 'Recusada'
  return abaixoDaTabela ? 'Aguardando aprovação' : 'Em análise'
}

function varianteSituacao(status: Proposta['status']) {
  if (status === 'aprovada') return 'normal'
  if (status === 'recusada') return 'critico'
  if (status === 'rascunho') return 'rascunho'
  return 'atencao'
}

function estadoAnalise(status: Proposta['status']): EstadoEtapa {
  if (status === 'pendente') return 'atual'
  if (status === 'recusada') return 'recusada'
  if (status === 'aprovada') return 'concluida'
  return 'futura'
}

function descricaoAnalise(status: Proposta['status']) {
  if (status === 'pendente') return 'Aguardando decisão'
  if (status === 'recusada') return 'Proposta recusada'
  if (status === 'aprovada') return 'Concluída'
  return 'Após o envio'
}

function Dado({ rotulo, valor }: Readonly<{ rotulo: string; valor?: string }>) {
  return <div className="detalhe-proposta__dado"><dt>{rotulo}</dt><dd>{valor || '—'}</dd></div>
}

function Etapa({ titulo, detalhe, estado }: Readonly<{ titulo: string; detalhe: string; estado: EstadoEtapa }>) {
  return <li className={`detalhe-proposta__etapa detalhe-proposta__etapa--${estado}`}>
    <span className="detalhe-proposta__marcador" aria-hidden />
    <div><strong>{titulo}</strong><small>{detalhe}</small></div>
  </li>
}

export function DetalhePropostaPage() {
  const { id } = useParams()
  const db = useDb()
  const { usuario } = useAuth()
  const notificar = useToast()
  const [dialogo, setDialogo] = useState<Acao | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [justificativa, setJustificativa] = useState('')
  const [novoValor, setNovoValor] = useState<number | null>(null)

  const proposta = db.propostas.find((item) => item.id === id || item.codigo === id)
  if (!proposta) {
    return <main className="conteudo"><section className="card vazio"><h1>Proposta não encontrada</h1><p>Confira o endereço ou selecione outra proposta.</p><Link to="/dashboard" className="btn btn--secundario">Voltar ao dashboard</Link></section></main>
  }

  const imovel = db.imoveis.find((item) => item.id === proposta.imovelId)
  const cliente = db.clientes.find((item) => item.id === proposta.clienteId)
  const responsavel = [...db.corretores, ...db.usuarios].find((item) => item.id === proposta.corretorId)
  const tabela = imovel?.valores.tabela ?? null
  const minimo = imovel?.valores.minimo ?? null
  const abaixoDaTabela = tabela !== null && proposta.valor < tabela
  const desconto = tabela && abaixoDaTabela ? ((tabela - proposta.valor) / tabela) * 100 : 0
  const parcelas = proposta.parcelas && proposta.parcelas > 0
    ? (proposta.valor - (proposta.entrada ?? 0)) / proposta.parcelas : null
  let textoEntrada: string | undefined
  if (proposta.entrada !== undefined) {
    textoEntrada = formatarMoedaInteira(proposta.entrada)
    if (proposta.valor > 0) textoEntrada += ` (${Math.round(proposta.entrada / proposta.valor * 100)}%)`
  }
  let textoDesconto: string | undefined
  if (tabela !== null) {
    textoDesconto = abaixoDaTabela ? `−${desconto.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : 'Sem desconto'
  }
  const titulo = imovel
    ? `${nomeLote(imovel.endereco.lote, imovel.endereco.quadra)} — ${imovel.loteamento}`
    : 'Imóvel não encontrado'
  const eventos = db.historico
    .filter((evento) => evento.imovelId === proposta.imovelId &&
      (evento.referencia === proposta.codigo || evento.descricao.includes(proposta.codigo) || evento.tipo === 'Reserva'))
    .sort((a, b) => b.data.localeCompare(a.data))
    .slice(0, 5)
  const estadoDiretoria: EstadoEtapa = proposta.status === 'aprovada' ? 'concluida' : 'futura'

  function abrir(acao: Acao) {
    setJustificativa('')
    setNovoValor(null)
    setDialogo(acao)
  }

  async function executar() {
    if (!dialogo || !proposta) return
    setCarregando(true)
    try {
      if (dialogo === 'aprovar') {
        await aprovarProposta(proposta.id, usuario?.nome)
        notificar('Proposta aprovada e venda registrada.')
      } else if (dialogo === 'recusar') {
        await recusarProposta(proposta.id, justificativa, usuario?.nome)
        notificar('Proposta recusada.', 'info')
      } else {
        if (!usuario || novoValor === null) throw new Error('Informe o novo valor da proposta.')
        await registrarContraproposta(proposta.id, novoValor, justificativa, usuario)
        notificar('Contraproposta registrada.')
      }
      setDialogo(null)
    } catch (erro) {
      notificar(erro instanceof Error ? erro.message : 'Não foi possível concluir a ação.', 'erro')
    } finally {
      setCarregando(false)
    }
  }

  let tituloDialogo = 'Aprovar proposta?'
  let textoConfirmar = 'Confirmar aprovação'
  if (dialogo === 'recusar') {
    tituloDialogo = 'Recusar proposta?'
    textoConfirmar = 'Recusar proposta'
  } else if (dialogo === 'contraproposta') {
    tituloDialogo = 'Registrar contraproposta'
    textoConfirmar = 'Registrar contraproposta'
  }
  const desabilitarConfirmacao = (dialogo === 'recusar' && !justificativa.trim()) ||
    (dialogo === 'contraproposta' && (!novoValor || novoValor === proposta.valor || !justificativa.trim()))

  return <>
    <header className="cabecalho">
      <div>
        <nav className="migalhas" aria-label="Você está em"><Link to="/propostas">Propostas</Link><span aria-hidden>›</span><span>{proposta.codigo}</span></nav>
        <div className="detalhe-proposta__titulo-linha"><h1 className="cabecalho__titulo">{titulo}</h1><span className={`badge badge--${varianteSituacao(proposta.status)}`}>{rotuloSituacao(proposta, abaixoDaTabela)}</span></div>
      </div>
      {proposta.status === 'pendente' && <div className="cabecalho__acoes">
        <button type="button" className="btn btn--secundario detalhe-proposta__recusar" onClick={() => abrir('recusar')}>Recusar proposta</button>
        <button type="button" className="btn btn--suave" onClick={() => abrir('contraproposta')}>Contraproposta</button>
        <button type="button" className="btn btn--primario" onClick={() => abrir('aprovar')}>Aprovar proposta</button>
      </div>}
      {proposta.status === 'rascunho' && <Link className="btn btn--primario" to={`/propostas/nova?rascunho=${proposta.id}`}>Continuar rascunho</Link>}
    </header>

    <main className="conteudo detalhe-proposta">
      <div className="detalhe-proposta__principal pilha">
        <section className="card secao" aria-labelledby="titulo-valores">
          <div className="secao__cabecalho"><h2 id="titulo-valores" className="card__titulo">Valores</h2><p className="card__subtitulo">Comparativo com a tabela vigente do empreendimento</p></div>
          <dl className="detalhe-proposta__valores">
            <Dado rotulo="Valor de tabela" valor={tabela === null ? undefined : formatarMoedaInteira(tabela)} />
            <Dado rotulo="Valor proposto" valor={formatarMoedaInteira(proposta.valor)} />
            <Dado rotulo="Desconto" valor={textoDesconto} />
            <Dado rotulo="Mínimo aceito" valor={minimo === null ? undefined : formatarMoedaInteira(minimo)} />
          </dl>
          {minimo !== null && proposta.valor <= minimo && <p className="detalhe-proposta__aviso">{proposta.valor === minimo ? 'A proposta atinge exatamente o valor mínimo autorizado para este lote.' : 'A proposta está abaixo do valor mínimo cadastrado para este lote.'}</p>}
        </section>

        <section className="card secao" aria-labelledby="titulo-pagamento">
          <div className="secao__cabecalho"><h2 id="titulo-pagamento" className="card__titulo">Condições de pagamento</h2><p className="card__subtitulo">Registradas com a proposta em {dataHora(proposta.criadaEm)}</p></div>
          <dl className="detalhe-proposta__dados">
            <Dado rotulo="Forma" valor={proposta.formaPagamento ?? proposta.condicao} />
            <Dado rotulo="Entrada" valor={textoEntrada} />
            <Dado rotulo="Parcelas" valor={parcelas === null ? undefined : `${proposta.parcelas}x de ${formatarMoedaInteira(parcelas)}`} />
            <Dado rotulo="Índice" valor={proposta.indiceCorrecao} />
            <Dado rotulo="Primeira parcela" valor={dataSimples(proposta.primeiroVencimento)} />
            <Dado rotulo="Validade" valor={proposta.validadeDias ? `${proposta.validadeDias} dias` : undefined} />
            <Dado rotulo="Expira em" valor={proposta.expiraEm ? dataHora(proposta.expiraEm) : undefined} />
            <Dado rotulo="Versão" valor={String(proposta.versao ?? 1)} />
          </dl>
        </section>

        <section className="card secao" aria-labelledby="titulo-cliente-imovel">
          <div className="secao__cabecalho"><h2 id="titulo-cliente-imovel" className="card__titulo">Cliente e imóvel</h2></div>
          <dl className="detalhe-proposta__dados">
            <Dado rotulo="Cliente" valor={cliente?.nome} />
            <Dado rotulo="Imóvel" valor={titulo} />
            <Dado rotulo="Área" valor={imovel?.dimensoes.areaTotal ? `${formatarDecimal(imovel.dimensoes.areaTotal)} m²` : undefined} />
            <Dado rotulo="Responsável" valor={responsavel?.nome} />
            <Dado rotulo="Código" valor={imovel?.codigo} />
            <Dado rotulo="Matrícula" valor={imovel?.matricula} />
          </dl>
          <div className="detalhe-proposta__observacoes"><strong>Observações</strong><p>{proposta.observacoes || 'Nenhuma observação registrada.'}</p></div>
        </section>
      </div>

      <aside className="detalhe-proposta__lateral pilha">
        <section className="card secao" aria-labelledby="titulo-fluxo">
          <div className="secao__cabecalho"><h2 id="titulo-fluxo" className="card__titulo">Fluxo de aprovação</h2><p className="card__subtitulo">Acompanhamento da proposta</p></div>
          <ol className="detalhe-proposta__fluxo">
            <Etapa titulo="Proposta enviada" detalhe={proposta.status === 'rascunho' ? 'Aguardando envio' : dataHora(proposta.criadaEm)} estado={proposta.status === 'rascunho' ? 'futura' : 'concluida'} />
            <Etapa titulo="Análise comercial" detalhe={descricaoAnalise(proposta.status)} estado={estadoAnalise(proposta.status)} />
            {abaixoDaTabela && <Etapa titulo="Aprovação da diretoria" detalhe={proposta.status === 'aprovada' ? 'Concluída' : 'Necessária pelo desconto'} estado={estadoDiretoria} />}
            <Etapa titulo="Contrato gerado" detalhe={proposta.status === 'aprovada' ? 'Venda registrada' : 'Após aprovação'} estado={proposta.status === 'aprovada' ? 'concluida' : 'futura'} />
          </ol>
        </section>

        <section className="card secao" aria-labelledby="titulo-historico-proposta">
          <div className="secao__cabecalho"><h2 id="titulo-historico-proposta" className="card__titulo">Histórico</h2><p className="card__subtitulo">Registro imutável de auditoria</p></div>
          {eventos.length ? <ol className="detalhe-proposta__historico">{eventos.map((evento) => <li key={evento.id}><time dateTime={evento.data}>{dataHora(evento.data)}</time><p>{evento.descricao}</p></li>)}</ol> : <p className="card__vazio">Nenhum evento registrado para esta proposta.</p>}
        </section>
      </aside>
    </main>

    <Dialogo aberto={dialogo !== null} titulo={tituloDialogo} textoConfirmar={textoConfirmar} perigoso={dialogo === 'recusar'} carregando={carregando} confirmarDesabilitado={Boolean(desabilitarConfirmacao)} onCancelar={() => setDialogo(null)} onConfirmar={executar}>
      {dialogo === 'aprovar' && <p className="dialogo__descricao">A aprovação registra a venda e encerra outras propostas pendentes para este imóvel.</p>}
      {dialogo === 'contraproposta' && <Campo rotulo="Novo valor">{(props) => <InputNumerico {...props} prefixo="R$" valor={novoValor} onChange={setNovoValor} />}</Campo>}
      {(dialogo === 'recusar' || dialogo === 'contraproposta') && <Campo rotulo="Justificativa">{(props) => <textarea {...props} className="input input--area" rows={3} required value={justificativa} onChange={(evento) => setJustificativa(evento.target.value)} placeholder="Descreva o motivo da decisão" />}</Campo>}
      {carregando && <Spinner />}
    </Dialogo>
  </>
}
