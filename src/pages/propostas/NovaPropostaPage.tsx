import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { Campo } from '../../components/ui'
import { InputNumerico } from '../../components/InputNumerico'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useDb } from '../../data/db'
import { nomeLote, reservaAtiva, rotuloImovel } from '../../data/selectors'
import { formatarMoedaInteira } from '../../lib/format'
import { salvarProposta, validarProposta, type DadosNovaProposta } from '../../services/propostas'

function dataEmDias(dias: number) {
  const data = new Date()
  data.setDate(data.getDate() + dias)
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
}

function dadosIniciais(imovelId = ''): DadosNovaProposta {
  return {
    imovelId,
    clienteId: '',
    valor: 0,
    entrada: 0,
    parcelas: 0,
    indiceCorrecao: '',
    primeiroVencimento: '',
    formaPagamento: '',
    validadeDias: 0,
    aprovador: '',
    observacoes: '',
    anexos: [],
  }
}

export function NovaPropostaPage() {
  const db = useDb()
  const { usuario } = useAuth()
  const notificar = useToast()
  const navigate = useNavigate()
  const [parametros, definirParametros] = useSearchParams()
  const rascunho = db.propostas.find((item) => item.id === parametros.get('rascunho') && item.status === 'rascunho')
  const imoveisDisponiveis = db.imoveis.filter((item) =>
    item.status === 'publicado' && item.situacao === 'disponivel' &&
    !db.reservas.some((reserva) => reserva.imovelId === item.id && reservaAtiva(reserva, Date.now())) &&
    !db.propostas.some((proposta) => proposta.imovelId === item.id && proposta.status === 'pendente'))
  const imovelInicial = imoveisDisponiveis.find((item) => item.id === parametros.get('imovel'))
  const imovelRascunho = db.imoveis.find((item) => item.id === rascunho?.imovelId)
  const [loteamentoSelecionado, setLoteamentoSelecionado] = useState(imovelRascunho?.loteamento ?? imovelInicial?.loteamento ?? '')
  const [form, setForm] = useState<DadosNovaProposta>(() => rascunho
    ? {
      imovelId: rascunho.imovelId,
      clienteId: rascunho.clienteId,
      valor: rascunho.valor,
      entrada: rascunho.entrada ?? 0,
      parcelas: rascunho.parcelas ?? 0,
      indiceCorrecao: rascunho.indiceCorrecao ?? '',
      primeiroVencimento: rascunho.primeiroVencimento ?? '',
      formaPagamento: rascunho.formaPagamento ?? '',
      validadeDias: rascunho.validadeDias ?? 0,
      aprovador: rascunho.aprovador ?? '',
      observacoes: rascunho.observacoes ?? '',
      anexos: rascunho.anexos ?? [],
    }
    : dadosIniciais(imovelInicial?.id))
  const [erros, setErros] = useState<Record<string, string>>({})
  const [enviando, setEnviando] = useState(false)
  const [idSalvo, setIdSalvo] = useState(rascunho?.id)

  const loteamentos = [...new Set(imoveisDisponiveis.map((item) => item.loteamento))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const imoveisDoLoteamento = imoveisDisponiveis.filter((item) => item.loteamento === loteamentoSelecionado)
  const imoveisParaEscolha = loteamentoSelecionado ? imoveisDoLoteamento : imoveisDisponiveis
  const imovel = db.imoveis.find((item) => item.id === form.imovelId)
  const tabela = imovel?.valores.tabela ?? 0
  const desconto = tabela > 0 && form.valor > 0 ? Math.max(0, (tabela - form.valor) / tabela * 100) : 0
  const parcelas = form.parcelas && form.parcelas > 0 ? (form.valor - (form.entrada ?? 0)) / form.parcelas : 0
  const exigeAlcada = form.valor > 0 && form.valor < tabela

  function alterar<K extends keyof DadosNovaProposta>(campo: K, valor: DadosNovaProposta[K]) {
    setForm((anterior) => ({ ...anterior, [campo]: valor }))
    setErros((anterior) => ({ ...anterior, [campo]: '' }))
  }

  function selecionarImovel(id: string) {
    const selecionado = db.imoveis.find((item) => item.id === id)
    alterar('imovelId', id)
    if (selecionado) setLoteamentoSelecionado(selecionado.loteamento)
  }

  function selecionarLoteamento(nome: string) {
    setLoteamentoSelecionado(nome)
    alterar('imovelId', '')
  }

  function salvar(enviar: boolean) {
    const encontrados = enviar ? validarProposta(form) : {
      ...(!form.imovelId ? { imovelId: 'Selecione um imóvel.' } : {}),
      ...(!form.clienteId ? { clienteId: 'Selecione um cliente.' } : {}),
    }
    setErros(encontrados)
    if (Object.keys(encontrados).length) {
      notificar('Revise os campos destacados.', 'erro')
      return
    }
    setEnviando(true)
    try {
      const id = salvarProposta(form, enviar ? 'pendente' : 'rascunho', idSalvo, usuario ?? undefined)
      setIdSalvo(id)
      if (enviar) {
        notificar('Proposta enviada para aprovação.')
        navigate('/propostas')
      } else {
        definirParametros({ rascunho: id }, { replace: true })
        notificar('Rascunho salvo.')
      }
    } catch (erro) {
      notificar(erro instanceof Error ? erro.message : 'Não foi possível salvar a proposta.', 'erro')
    } finally {
      setEnviando(false)
    }
  }

  if (!imoveisDisponiveis.length) {
    return <main className="conteudo"><section className="card vazio"><h1>Nenhum imóvel disponível</h1><p>Cadastre ou libere um imóvel antes de preparar a proposta.</p><Link className="btn btn--secundario" to="/imoveis">Ver imóveis</Link></section></main>
  }

  return (
    <>
      <header className="cabecalho cabecalho--fixo">
        <div>
          <nav className="migalhas" aria-label="Você está em"><Link to="/propostas">Propostas</Link><span aria-hidden>›</span><span>Nova proposta</span></nav>
          <h1 className="cabecalho__titulo">Nova proposta</h1>
          <p className="cabecalho__subtitulo">{imovel ? rotuloImovel(imovel) : 'Selecione um imóvel e um cliente para começar'} · RF17</p>
        </div>
        <div className="cabecalho__acoes">
          <button type="button" className="btn btn--secundario" disabled={enviando} onClick={() => salvar(false)}>Salvar rascunho</button>
          <button type="button" className="btn btn--primario" disabled={enviando} onClick={() => salvar(true)}>Enviar para aprovação</button>
        </div>
      </header>
      <main className="conteudo proposta-form pilha">
        <section className="card secao" aria-labelledby="proposta-imovel">
          <div className="secao__cabecalho"><h2 id="proposta-imovel" className="card__titulo">Imóvel e cliente</h2><p className="card__subtitulo">Selecione o imóvel e o cliente. O loteamento e o lote acompanham o imóvel escolhido.</p></div>
          <div className="proposta-form__grade proposta-form__grade--vinculo">
            <Campo rotulo="Imóvel" erro={erros.imovelId}>{(props) => <select {...props} className="input select" value={form.imovelId} onChange={(evento) => selecionarImovel(evento.target.value)}><option value="">Selecione um imóvel</option>{imoveisParaEscolha.map((item) => <option key={item.id} value={item.id}>{rotuloImovel(item)}</option>)}</select>}</Campo>
            <Campo rotulo="Loteamento">{(props) => <select {...props} className="input select" value={loteamentoSelecionado} onChange={(evento) => selecionarLoteamento(evento.target.value)}><option value="">Selecione um loteamento</option>{loteamentos.map((nome) => <option key={nome} value={nome}>{nome}</option>)}</select>}</Campo>
            <Campo rotulo="Lote">{(props) => <select {...props} className="input select" value={form.imovelId} onChange={(evento) => selecionarImovel(evento.target.value)} disabled={!loteamentoSelecionado}><option value="">Selecione um lote</option>{imoveisDoLoteamento.map((item) => <option key={item.id} value={item.id}>{nomeLote(item.endereco.lote, item.endereco.quadra)}</option>)}</select>}</Campo>
            <Campo rotulo="Cliente" erro={erros.clienteId}>{(props) => <select {...props} className="input select" value={form.clienteId} onChange={(evento) => alterar('clienteId', evento.target.value)}><option value="">Selecione um cliente</option>{db.clientes.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select>}</Campo>
          </div>
        </section>

        <section className="card secao" aria-labelledby="proposta-condicoes">
          <div className="secao__cabecalho"><h2 id="proposta-condicoes" className="card__titulo">Condições comerciais</h2><p className="card__subtitulo">Valores calculados automaticamente a partir do valor de tabela e do desconto.</p></div>
          <div className="proposta-form__grade proposta-form__grade--comercial">
            <Campo rotulo="Valor de tabela">{(props) => <input {...props} className="input" value={tabela ? formatarMoedaInteira(tabela) : ''} placeholder="Valor do imóvel" readOnly />}</Campo>
            <Campo rotulo="Desconto">{(props) => <input {...props} className="input" value={tabela && form.valor > 0 ? `${desconto.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% · ${formatarMoedaInteira(Math.max(0, tabela - form.valor))}` : ''} placeholder="Calculado automaticamente" readOnly />}</Campo>
            <Campo rotulo="Valor proposto" erro={erros.valor}>{(props) => <InputNumerico {...props} prefixo="R$" placeholder="Ex.: 350.000,00" valor={form.valor || null} onChange={(valor) => alterar('valor', valor ?? 0)} />}</Campo>
            <Campo rotulo="Entrada" erro={erros.entrada}>{(props) => <InputNumerico {...props} prefixo="R$" placeholder="Ex.: 70.000,00" valor={form.entrada || null} onChange={(valor) => alterar('entrada', valor ?? 0)} />}</Campo>
            <Campo rotulo="Parcelas" erro={erros.parcelas}>{(props) => <div className="proposta-form__parcelas"><input {...props} className="input" type="number" min="1" step="1" placeholder="Ex.: 24" value={form.parcelas || ''} onChange={(evento) => alterar('parcelas', Number(evento.target.value))} />{(form.parcelas ?? 0) > 0 && form.valor > 0 && <span>{form.parcelas}x de {formatarMoedaInteira(Math.max(0, parcelas))}</span>}</div>}</Campo>
            <Campo rotulo="Índice de correção">{(props) => <select {...props} className="input select" value={form.indiceCorrecao ?? ''} onChange={(evento) => alterar('indiceCorrecao', evento.target.value)}><option value="" disabled>Selecione um índice</option><option>IGP-M</option><option>IPCA</option><option>Sem correção</option></select>}</Campo>
            <Campo rotulo="Primeiro vencimento" erro={erros.primeiroVencimento}>{(props) => <input {...props} className="input" type="date" value={form.primeiroVencimento ?? ''} onChange={(evento) => alterar('primeiroVencimento', evento.target.value)} />}</Campo>
            <Campo rotulo="Forma de pagamento" erro={erros.formaPagamento}>{(props) => <select {...props} className="input select" value={form.formaPagamento ?? ''} onChange={(evento) => alterar('formaPagamento', evento.target.value)}><option value="" disabled>Selecione uma forma</option><option>Entrada + financiamento direto</option><option>À vista</option><option>Financiamento bancário</option></select>}</Campo>
          </div>
        </section>

        <section className="card secao" aria-labelledby="proposta-aprovacao">
          <div className="secao__cabecalho"><h2 id="proposta-aprovacao" className="card__titulo">Validade e aprovação</h2><p className="card__subtitulo">Descontos acima da alçada do vendedor exigem aprovação do gestor.</p></div>
          <div className="proposta-form__grade proposta-form__grade--aprovacao">
            <Campo rotulo="Validade da proposta" erro={erros.validadeDias}>{(props) => <input {...props} className="input" type="number" min="1" max="7" placeholder="Ex.: 7 dias" value={form.validadeDias || ''} onChange={(evento) => alterar('validadeDias', Number(evento.target.value))} />}</Campo>
            <Campo rotulo="Expira em">{(props) => <input {...props} className="input" value={form.validadeDias ? dataEmDias(form.validadeDias).split('-').reverse().join('/') : ''} placeholder="Calculado pela validade" readOnly />}</Campo>
            <Campo rotulo="Aprovador">{(props) => <input {...props} className="input" placeholder="Ex.: Nome do gestor" value={form.aprovador ?? ''} onChange={(evento) => alterar('aprovador', evento.target.value)} />}</Campo>
            <Campo rotulo="Acima da alçada">{(props) => <input {...props} className="input" value={tabela && form.valor > 0 ? exigeAlcada ? 'Sim — exige aprovação' : 'Não' : ''} placeholder="Calculado automaticamente" readOnly />}</Campo>
          </div>
          <p className="nota-regra">RF21 — prazo inicial de até 7 dias. Após o envio, a proposta é marcada como pendente e a reserva volta a contar o próprio prazo.</p>
        </section>

        <section className="card secao" aria-labelledby="proposta-observacoes">
          <div className="secao__cabecalho"><h2 id="proposta-observacoes" className="card__titulo">Observações e anexos</h2><p className="card__subtitulo">Tudo o que o gestor precisa ler antes de aprovar.</p></div>
          <div className="proposta-form__grade proposta-form__grade--observacoes">
            <Campo rotulo="Observações">{(props) => <textarea {...props} className="input input--area" rows={2} placeholder="Ex.: Condições discutidas com o cliente" value={form.observacoes ?? ''} onChange={(evento) => alterar('observacoes', evento.target.value)} />}</Campo>
            <Campo rotulo="Anexos">{(props) => <input {...props} className="input proposta-form__arquivo" type="file" multiple accept=".pdf,.png,.jpg,.jpeg" onChange={(evento) => alterar('anexos', Array.from(evento.target.files ?? []).map((arquivo) => arquivo.name))} />}</Campo>
          </div>
          {Boolean(form.anexos?.length) && <p className="proposta-form__anexos">{form.anexos?.join(' · ')}</p>}
          <p className="nota-regra">RF32 — o envio registra a proposta na trilha de auditoria do imóvel.</p>
        </section>
      </main>
    </>
  )
}
