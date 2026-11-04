import { Paperclip, X } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { Dialogo } from '../../components/Dialogo'
import { InputNumerico } from '../../components/InputNumerico'
import { Campo, Spinner } from '../../components/ui'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useDb } from '../../data/db'
import { reservaAtiva, rotuloImovel } from '../../data/selectors'
import type { Cliente, Imovel, Proposta, Reserva } from '../../data/types'
import { formatarMoeda, formatarMoedaInteira } from '../../lib/format'
import {
  acimaDaAlcada,
  calcularCondicoes,
  condicoesDoForm,
  CONFIG_PROPOSTAS,
  descreverMudancas,
  exigeDiretoria,
  formatarParcelas,
  formatarPercentual,
  formDaVersao,
  formVazio,
  FORMAS_PAGAMENTO,
  INDICES_CORRECAO,
  instanteExpiracaoProposta,
  lerNumero,
  OPCOES_ESCRITURA,
  OPCOES_GARANTIA,
  podeDecidir,
  permiteNovaVersao,
  propostaAberta,
  validarProposta,
  versaoAtual,
  type CampoErroProposta,
  type FormProposta,
} from '../../lib/propostas'
import { dataCalendario, formatarData } from '../../lib/reservas'
import { useAgora } from '../../lib/useAgora'
import { criarNovaVersao, enviarProposta, salvarRascunhoProposta } from '../../services/propostas'
import { aprovadoresDisponiveis } from './proposta'

type Modo = 'nova' | 'editar' | 'versao'

interface Contexto {
  modo: Modo
  reserva: Reserva
  imovel: Imovel
  cliente: Cliente | undefined
  valorTabela: number
  proposta?: Proposta
  contraproposta: boolean
}

/** Cabeçalho + cartão de aviso, usado quando o formulário não pode ser aberto. */
function Aviso({ titulo, migalha, children }: { titulo: string; migalha: string; children: ReactNode }) {
  return (
    <>
      <header className="cabecalho">
        <div>
          <nav className="migalhas" aria-label="Você está em">
            <Link to="/propostas">Propostas</Link>
            <span aria-hidden>›</span>
            <span>{migalha}</span>
          </nav>
          <h1 className="cabecalho__titulo">{migalha}</h1>
        </div>
      </header>
      <main className="conteudo">
        <section className="card vazio" aria-labelledby="aviso-titulo">
          <h2 id="aviso-titulo">{titulo}</h2>
          {children}
        </section>
      </main>
    </>
  )
}

/** Sem reserva informada: escolhe uma reserva ativa sem proposta aberta (RF17). */
function EscolherReserva() {
  const db = useDb()
  const agora = useAgora()
  const navigate = useNavigate()
  const [reservaId, setReservaId] = useState('')
  const disponiveis = db.reservas
    .filter((r) => reservaAtiva(r, agora) && !propostaAberta(db.propostas, r.id, agora))
    .sort((a, b) => a.codigo.localeCompare(b.codigo))
  const rotulo = (r: Reserva) => {
    const imovel = db.imoveis.find((i) => i.id === r.imovelId)
    const cliente = db.clientes.find((c) => c.id === r.clienteId)
    return `${r.codigo} · ${imovel ? rotuloImovel(imovel) : 'Imóvel'} · ${cliente?.nome ?? 'Cliente'}`
  }
  return (
    <Aviso titulo="Selecione a reserva ativa" migalha="Nova proposta">
      <p>Toda proposta é gerada a partir de uma reserva ativa, que define o imóvel e o cliente (RF17).</p>
      {disponiveis.length === 0 ? (
        <>
          <p>Não há reservas ativas sem proposta em andamento.</p>
          <Link to="/reservas" className="btn btn--secundario">
            Ir para reservas
          </Link>
        </>
      ) : (
        <form
          className="pilha"
          onSubmit={(e) => {
            e.preventDefault()
            if (reservaId) navigate(`/propostas/nova?reserva=${reservaId}`)
          }}
        >
          <Campo rotulo="Reserva ativa">
            {(p) => (
              <select {...p} className="input select" value={reservaId} onChange={(e) => setReservaId(e.target.value)}>
                <option value="">Selecione</option>
                {disponiveis.map((r) => (
                  <option key={r.id} value={r.id}>
                    {rotulo(r)}
                  </option>
                ))}
              </select>
            )}
          </Campo>
          <button type="submit" className="btn btn--primario" disabled={!reservaId}>
            Gerar proposta
          </button>
        </form>
      )}
    </Aviso>
  )
}

/** Resolve reserva/proposta pela rota e decide se o formulário pode abrir. */
export function PropostaFormPage({ modo }: { modo: Modo }) {
  const db = useDb()
  const agora = useAgora()
  const { id } = useParams()
  const [params] = useSearchParams()
  const { usuario } = useAuth()

  const proposta = modo === 'nova' ? undefined : db.propostas.find((p) => p.id === id)
  const reservaId = proposta?.reservaId ?? params.get('reserva')
  const contraproposta = modo === 'versao' && params.get('contraproposta') === '1'

  if (modo === 'nova' && !reservaId) return <EscolherReserva />
  if (modo !== 'nova' && !proposta) {
    return (
      <Aviso titulo="Proposta não encontrada" migalha="Proposta">
        <Link to="/propostas" className="btn btn--secundario">
          Voltar para propostas
        </Link>
      </Aviso>
    )
  }

  const reserva = db.reservas.find((r) => r.id === reservaId)
  const imovel = reserva && db.imoveis.find((i) => i.id === reserva.imovelId)
  const migalha = modo === 'versao' ? 'Nova versão' : 'Nova proposta'

  if (proposta && modo === 'editar' && proposta.situacao !== 'rascunho') {
    return (
      <Aviso titulo="Esta proposta já foi enviada" migalha={migalha}>
        <p>Depois do envio, as condições não podem ser alteradas. Registre uma nova versão (RF18).</p>
        <Link to={`/propostas/${proposta.id}/versoes`} className="btn btn--secundario">
          Ver versões
        </Link>
      </Aviso>
    )
  }
  if (proposta && modo === 'versao') {
    const permitido = contraproposta ? podeDecidir(proposta, usuario?.id, agora) : permiteNovaVersao(proposta, agora)
    if (!permitido) {
      return (
        <Aviso titulo={contraproposta ? 'Contraproposta indisponível' : 'Nova versão indisponível'} migalha={migalha}>
          <p>
            {contraproposta
              ? 'Somente o responsável pela etapa atual pode fazer uma contraproposta.'
              : 'Só é possível criar versões de propostas em negociação (não decididas nem expiradas).'}
          </p>
          <Link to={`/propostas/${proposta.id}`} className="btn btn--secundario">
            Voltar para a proposta
          </Link>
        </Aviso>
      )
    }
  }

  if (modo !== 'versao') {
    // RF17: só reserva ativa gera proposta (também ao continuar um rascunho).
    if (!reserva || !imovel) {
      return (
        <Aviso titulo="Reserva não encontrada" migalha={migalha}>
          <p>A proposta precisa de uma reserva ativa. Escolha outra reserva para continuar.</p>
          <Link to="/propostas/nova" className="btn btn--secundario">
            Escolher reserva
          </Link>
        </Aviso>
      )
    }
    if (!reservaAtiva(reserva, agora)) {
      return (
        <Aviso titulo={`A reserva ${reserva.codigo} não está ativa`} migalha={migalha}>
          <p>Propostas só podem ser geradas a partir de uma reserva ativa (RF17). Renove a reserva ou escolha outra.</p>
          <div className="cabecalho__acoes">
            <Link to={`/reservas/${reserva.id}`} className="btn btn--secundario">
              Ver reserva
            </Link>
            <Link to="/propostas/nova" className="btn btn--primario">
              Escolher outra reserva
            </Link>
          </div>
        </Aviso>
      )
    }
    const aberta = propostaAberta(db.propostas, reserva.id, agora, proposta?.id)
    if (aberta) {
      return (
        <Aviso titulo={`A reserva ${reserva.codigo} já tem a proposta ${aberta.codigo}`} migalha={migalha}>
          <p>Cada reserva tem no máximo uma proposta em andamento. Continue a existente ou registre uma nova versão dela.</p>
          <Link to={aberta.situacao === 'rascunho' ? `/propostas/${aberta.id}/editar` : `/propostas/${aberta.id}`} className="btn btn--primario">
            {aberta.situacao === 'rascunho' ? 'Continuar rascunho' : 'Ver proposta'}
          </Link>
        </Aviso>
      )
    }
    if (!imovel.valores.tabela) {
      return (
        <Aviso titulo="Imóvel sem valor de tabela" migalha={migalha}>
          <p>Cadastre o valor de tabela do imóvel para calcular as condições da proposta.</p>
          <Link to={`/imoveis/${imovel.id}`} className="btn btn--secundario">
            Editar imóvel
          </Link>
        </Aviso>
      )
    }
  }

  if (!reserva || !imovel) {
    return (
      <Aviso titulo="Reserva não encontrada" migalha={migalha}>
        <Link to="/propostas" className="btn btn--secundario">
          Voltar para propostas
        </Link>
      </Aviso>
    )
  }

  const contexto: Contexto = {
    modo,
    reserva,
    imovel,
    cliente: db.clientes.find((c) => c.id === reserva.clienteId),
    // O valor de tabela fica congelado na proposta; versões novas usam o da primeira.
    valorTabela: proposta ? proposta.versoes[0].condicoes.valorTabela : imovel.valores.tabela!,
    proposta,
    contraproposta,
  }
  return <FormularioProposta key={`${modo}-${proposta?.id ?? reserva.id}`} {...contexto} />
}

function FormularioProposta({ modo, reserva, imovel, cliente, valorTabela, proposta, contraproposta }: Contexto) {
  const db = useDb()
  const navigate = useNavigate()
  const notificar = useToast()
  const { usuario } = useAuth()
  const idAnexos = useId()
  const hoje = dataCalendario(new Date())
  const base = proposta ? versaoAtual(proposta) : undefined

  const [iniciais] = useState<FormProposta>(() =>
    base
      ? formDaVersao(base)
      : formVazio({ hoje, descontoPercentual: reserva.descontoPercentual, formaPagamento: reserva.formaPagamento }),
  )
  const [form, setForm] = useState<FormProposta>(iniciais)
  const [tentou, setTentou] = useState(false)
  const [salvando, setSalvando] = useState<'rascunho' | 'envio' | null>(null)
  const [descartar, setDescartar] = useState(false)

  const alterar = (parcial: Partial<FormProposta>) => setForm((f) => ({ ...f, ...parcial }))
  const condicoes = condicoesDoForm(form, valorTabela, modo === 'versao' ? base : undefined)
  const calculo = calcularCondicoes(condicoes)
  const minimo = imovel.valores.minimo
  const erros = validarProposta(form, { valorTabela, minimo, hoje, envio: true })
  const desconto = lerNumero(form.descontoPercentual)
  const acima = desconto !== null && acimaDaAlcada(desconto)
  const diretoria = desconto !== null && exigeDiretoria(desconto)
  const expiraEm = erros.validadeDias ? null : instanteExpiracaoProposta(hoje, condicoes.validadeDias)
  const aprovadores = aprovadoresDisponiveis(db, CONFIG_PROPOSTAS.papeisAprovadores)
  const sujo = JSON.stringify(form) !== JSON.stringify(iniciais)
  const proximaVersao = (base?.numero ?? 0) + 1
  const oQueMudou = modo === 'versao' && base ? descreverMudancas(base.condicoes, condicoes) : ''
  const voltarPara = proposta ? (modo === 'versao' ? `/propostas/${proposta.id}/versoes` : `/propostas/${proposta.id}`) : '/propostas'

  /** Erros aparecem após a primeira tentativa; o valor abaixo do mínimo aparece de imediato. */
  const erro = (campo: CampoErroProposta) => (campo === 'valorProposto' || tentou ? erros[campo] : undefined)

  const salvarRascunho = async () => {
    const formato = validarProposta(form, { valorTabela, minimo, hoje, envio: false })
    if (Object.keys(formato).length) {
      setTentou(true)
      notificar('Revise os campos destacados.', 'erro')
      return
    }
    setSalvando('rascunho')
    try {
      const salva = await salvarRascunhoProposta({ reservaId: reserva.id, propostaId: proposta?.id, form }, usuario?.nome ?? 'Administrador')
      notificar(`Rascunho ${salva.codigo} salvo. Ele ainda não foi enviado para aprovação.`, 'info')
      navigate(`/propostas/${salva.id}`)
    } catch (e) {
      notificar(e instanceof Error ? e.message : 'Não foi possível salvar o rascunho.', 'erro')
      setSalvando(null)
    }
  }

  const enviar = async () => {
    setTentou(true)
    if (Object.keys(erros).length) {
      notificar('Revise os campos destacados.', 'erro')
      return
    }
    setSalvando('envio')
    try {
      if (modo === 'versao' && proposta) {
        const salva = await criarNovaVersao(proposta.id, form, { id: usuario?.id ?? '', nome: usuario?.nome ?? 'Administrador' }, { contraproposta })
        notificar(contraproposta ? `Contraproposta v${proximaVersao} enviada ao cliente.` : `Versão v${proximaVersao} enviada para aprovação.`)
        navigate(`/propostas/${salva.id}/versoes`)
      } else {
        const salva = await enviarProposta({ reservaId: reserva.id, propostaId: proposta?.id, form }, usuario?.nome ?? 'Administrador')
        notificar(`Proposta ${salva.codigo} enviada para aprovação.`)
        navigate(`/propostas/${salva.id}`)
      }
    } catch (e) {
      notificar(e instanceof Error ? e.message : 'Não foi possível enviar a proposta.', 'erro')
      setSalvando(null)
    }
  }

  const adicionarAnexos = (arquivos: FileList | null) => {
    if (!arquivos?.length) return
    const nomes = Array.from(arquivos, (a) => a.name)
    alterar({ anexos: [...form.anexos, ...nomes.filter((n) => !form.anexos.includes(n))] })
  }

  const titulo =
    modo === 'versao' && proposta
      ? `${proposta.codigo} — ${contraproposta ? 'Contraproposta' : 'Nova versão'} v${proximaVersao}`
      : 'Nova proposta'

  return (
    <>
      <header className="cabecalho cabecalho--fixo">
        <div>
          <nav className="migalhas" aria-label="Você está em">
            <Link to="/propostas">Propostas</Link>
            <span aria-hidden>›</span>
            {modo === 'versao' && proposta ? (
              <>
                <Link to={`/propostas/${proposta.id}/versoes`}>{proposta.codigo}</Link>
                <span aria-hidden>›</span>
                <span>{contraproposta ? 'Contraproposta' : 'Nova versão'}</span>
              </>
            ) : (
              <span>Nova proposta</span>
            )}
          </nav>
          <h1 className="cabecalho__titulo">{titulo}</h1>
          <p className="cabecalho__subtitulo">
            {modo === 'versao'
              ? `Cópia da versão v${base?.numero}; a anterior fica somente leitura · RF18`
              : `Gerada a partir da reserva ativa ${reserva.codigo} · RF17`}
          </p>
        </div>
        <div className="cabecalho__acoes">
          {modo === 'versao' ? (
            <button type="button" className="btn btn--secundario" onClick={() => (sujo ? setDescartar(true) : navigate(voltarPara))}>
              Cancelar
            </button>
          ) : (
            <button type="button" className="btn btn--secundario" onClick={salvarRascunho} disabled={salvando !== null}>
              {salvando === 'rascunho' && <Spinner />} Salvar rascunho
            </button>
          )}
          <button type="button" className="btn btn--primario" onClick={enviar} disabled={salvando !== null}>
            {salvando === 'envio' && <Spinner />}{' '}
            {modo === 'versao' ? (contraproposta ? 'Enviar contraproposta' : 'Enviar nova versão') : 'Enviar para aprovação'}
          </button>
        </div>
      </header>

      <main className="conteudo pilha">
        <section className="card secao">
          <div className="secao__cabecalho">
            <h2 className="card__titulo">Imóvel e cliente</h2>
            <p className="card__subtitulo">Preenchido a partir da reserva ativa; não pode ser alterado após o envio.</p>
          </div>
          <div className="grade">
            <Campo rotulo="Imóvel" className="c-5">
              {(p) => <input {...p} className="input" readOnly value={rotuloImovel(imovel)} />}
            </Campo>
            <Campo rotulo="Matrícula" className="c-2">
              {(p) => <input {...p} className="input" readOnly value={imovel.matricula || 'Pendente'} />}
            </Campo>
            <Campo rotulo="Cliente" className="c-3">
              {(p) => <input {...p} className="input" readOnly value={cliente?.nome ?? 'Cliente removido'} />}
            </Campo>
            <Campo rotulo="Reserva vinculada" className="c-2">
              {(p) => <input {...p} className="input" readOnly value={reserva.codigo} />}
            </Campo>
          </div>
        </section>

        <section className="card secao">
          <div className="secao__cabecalho">
            <h2 className="card__titulo">Condições comerciais</h2>
            <p className="card__subtitulo">Valores calculados automaticamente a partir do valor de tabela e do desconto.</p>
          </div>
          <div className="grade">
            <Campo rotulo="Valor de tabela" className="c-3">
              {(p) => <input {...p} className="input" readOnly value={formatarMoedaInteira(valorTabela)} />}
            </Campo>
            <Campo rotulo="Desconto (%)" erro={erro('descontoPercentual')} className="c-2">
              {(p) => (
                <div className="input-adorno">
                  <input
                    {...p}
                    className="input"
                    inputMode="decimal"
                    value={form.descontoPercentual}
                    onChange={(e) => alterar({ descontoPercentual: e.target.value })}
                  />
                  <span className="input-adorno__texto">%</span>
                </div>
              )}
            </Campo>
            <Campo rotulo="Desconto em R$" className="c-2">
              {(p) => <input {...p} className="input" readOnly value={formatarMoedaInteira(calculo.descontoValor)} />}
            </Campo>
            <Campo rotulo="Valor proposto" erro={erro('valorProposto')} className="c-3">
              {(p) => <input {...p} className="input input--destaque" readOnly value={formatarMoedaInteira(calculo.valorProposto)} />}
            </Campo>
            <Campo rotulo="Mínimo aceito" className="c-2">
              {(p) => <input {...p} className="input" readOnly placeholder="—" value={minimo ? formatarMoedaInteira(minimo) : ''} />}
            </Campo>

            <Campo
              rotulo="Entrada"
              erro={erro('entrada')}
              dica={form.entrada ? `${formatarPercentual(calculo.entradaPercentual)} do valor proposto` : undefined}
              className="c-3"
            >
              {(p) => <InputNumerico {...p} prefixo="R$" valor={form.entrada} onChange={(entrada) => alterar({ entrada })} />}
            </Campo>
            <Campo rotulo="Nº de parcelas" erro={erro('parcelas')} className="c-2">
              {(p) => (
                <input
                  {...p}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={CONFIG_PROPOSTAS.parcelasMaximas}
                  step={1}
                  className="input"
                  value={form.parcelas}
                  onChange={(e) => alterar({ parcelas: e.target.value })}
                />
              )}
            </Campo>
            <Campo rotulo="Parcelas" dica={`Valor exato: ${formatarMoeda(calculo.valorParcela)}`} className="c-3">
              {(p) => <input {...p} className="input" readOnly value={formatarParcelas(condicoes.parcelas, calculo.valorParcela)} />}
            </Campo>
            <Campo rotulo="Índice de correção" erro={erro('indiceCorrecao')} className="c-2">
              {(p) => (
                <select {...p} className="input select" value={form.indiceCorrecao} onChange={(e) => alterar({ indiceCorrecao: e.target.value })}>
                  {[...new Set([...INDICES_CORRECAO, form.indiceCorrecao])].map((i) => (
                    <option key={i}>{i}</option>
                  ))}
                </select>
              )}
            </Campo>
            <Campo rotulo="Primeiro vencimento" erro={erro('primeiroVencimento')} className="c-2">
              {(p) => (
                <input {...p} type="date" className="input" value={form.primeiroVencimento} onChange={(e) => alterar({ primeiroVencimento: e.target.value })} />
              )}
            </Campo>

            <Campo rotulo="Forma de pagamento" erro={erro('formaPagamento')} className="c-6">
              {(p) => (
                <>
                  <input
                    {...p}
                    className="input"
                    list={`${idAnexos}-formas`}
                    value={form.formaPagamento}
                    onChange={(e) => alterar({ formaPagamento: e.target.value })}
                  />
                  <datalist id={`${idAnexos}-formas`}>
                    {FORMAS_PAGAMENTO.map((f) => (
                      <option key={f} value={f} />
                    ))}
                  </datalist>
                </>
              )}
            </Campo>
            <Campo rotulo="Escritura" className="c-3">
              {(p) => (
                <select {...p} className="input select" value={form.escritura} onChange={(e) => alterar({ escritura: e.target.value })}>
                  {OPCOES_ESCRITURA.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              )}
            </Campo>
            <Campo rotulo="Garantia" className="c-3">
              {(p) => (
                <select {...p} className="input select" value={form.garantia} onChange={(e) => alterar({ garantia: e.target.value })}>
                  {OPCOES_GARANTIA.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              )}
            </Campo>
          </div>
          <p className="nota-regra">
            Parcelas calculadas com centavos e exibidas sem eles; a última parcela absorve o arredondamento (
            {formatarMoeda(calculo.ultimaParcela)}).
          </p>
        </section>

        <section className="card secao">
          <div className="secao__cabecalho">
            <h2 className="card__titulo">Validade e aprovação</h2>
            <p className="card__subtitulo">Descontos acima da alçada do vendedor exigem aprovação do gestor.</p>
          </div>
          <div className="grade">
            <Campo rotulo="Validade da proposta (dias úteis)" erro={erro('validadeDias')} className="c-3">
              {(p) => (
                <input
                  {...p}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={CONFIG_PROPOSTAS.validadeMaximaDiasUteis}
                  step={1}
                  className="input"
                  value={form.validadeDias}
                  onChange={(e) => alterar({ validadeDias: e.target.value })}
                />
              )}
            </Campo>
            <Campo rotulo="Expira em" dica="Contada a partir do envio" className="c-2">
              {(p) => <input {...p} className="input" readOnly placeholder="—" value={expiraEm ? formatarData(expiraEm) : ''} />}
            </Campo>
            <Campo
              rotulo="Aprovador"
              erro={erro('aprovadorId')}
              dica={acima ? undefined : 'Opcional dentro da alçada; sem escolha, vai para o gestor padrão.'}
              className="c-4"
            >
              {(p) => (
                <select {...p} className="input select" value={form.aprovadorId} onChange={(e) => alterar({ aprovadorId: e.target.value })}>
                  <option value="">Selecione</option>
                  {aprovadores.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.rotulo}
                    </option>
                  ))}
                </select>
              )}
            </Campo>
            <Campo
              rotulo="Acima da alçada"
              dica={diretoria ? `Acima de ${formatarPercentual(CONFIG_PROPOSTAS.alcadaGestorPercentual)}: também passa pela diretoria.` : undefined}
              className="c-3"
            >
              {(p) => (
                <input
                  {...p}
                  className="input"
                  readOnly
                  value={acima ? 'Sim — exige aprovação' : `Não — até ${formatarPercentual(CONFIG_PROPOSTAS.alcadaVendedorPercentual)}`}
                />
              )}
            </Campo>
          </div>
          <p className="nota-regra">
            RF21 — passada a validade sem decisão, a proposta é marcada como expirada e a reserva volta a contar o próprio prazo.
          </p>
        </section>

        <section className="card secao">
          <div className="secao__cabecalho">
            <h2 className="card__titulo">Observações e anexos</h2>
            <p className="card__subtitulo">Tudo o que o gestor precisa ter antes de aprovar.</p>
          </div>
          <div className="grade">
            <Campo rotulo="Observações" className="c-12">
              {(p) => (
                <textarea
                  {...p}
                  rows={2}
                  className="input input--area"
                  placeholder="Ex.: Cliente pediu simulação alternativa em 120x."
                  value={form.observacoes}
                  onChange={(e) => alterar({ observacoes: e.target.value })}
                />
              )}
            </Campo>
            <div className="campo c-12">
              <label htmlFor={idAnexos} className="campo__rotulo">
                Anexos
              </label>
              <div className="anexos">
                {form.anexos.length === 0 && <span className="texto-fraco">Nenhum anexo.</span>}
                {form.anexos.map((nome) => (
                  <span key={nome} className="anexos__item">
                    <Paperclip size={13} aria-hidden /> {nome}
                    <button
                      type="button"
                      className="anexos__remover"
                      aria-label={`Remover anexo ${nome}`}
                      onClick={() => alterar({ anexos: form.anexos.filter((a) => a !== nome) })}
                    >
                      <X size={13} aria-hidden />
                    </button>
                  </span>
                ))}
                <label className="btn btn--secundario btn--pequeno anexos__adicionar">
                  Adicionar arquivos
                  <input
                    id={idAnexos}
                    type="file"
                    multiple
                    className="sr-only"
                    aria-describedby={`${idAnexos}-dica`}
                    onChange={(e) => {
                      adicionarAnexos(e.target.files)
                      e.target.value = ''
                    }}
                  />
                </label>
              </div>
              <span id={`${idAnexos}-dica`} className="campo__dica">
                Só o nome dos arquivos é registrado: o upload de anexos ainda não está disponível.
              </span>
            </div>
            {modo === 'versao' && (
              <>
                <Campo rotulo="O que mudou" dica="Gerado automaticamente comparando com a versão anterior." className="c-12">
                  {(p) => <input {...p} className="input" readOnly value={oQueMudou} />}
                </Campo>
                <Campo rotulo="Comentário do autor (opcional)" className="c-12">
                  {(p) => (
                    <textarea
                      {...p}
                      rows={2}
                      className="input input--area"
                      placeholder={contraproposta ? 'Ex.: Podemos chegar a 2,5% com entrada de 25%.' : 'Ex.: Cliente aceitou reduzir a entrada.'}
                      value={form.comentario}
                      onChange={(e) => alterar({ comentario: e.target.value })}
                    />
                  )}
                </Campo>
              </>
            )}
          </div>
          <p className="nota-regra">RF32 — o envio registra autor, data e as condições exatas desta versão na trilha de auditoria.</p>
        </section>
      </main>

      <Dialogo
        aberto={descartar}
        titulo="Descartar a nova versão?"
        descricao="As alterações feitas nesta versão serão perdidas. A versão vigente continua como está."
        textoConfirmar="Descartar"
        textoCancelar="Continuar editando"
        perigoso
        onCancelar={() => setDescartar(false)}
        onConfirmar={() => navigate(voltarPara)}
      />
    </>
  )
}
