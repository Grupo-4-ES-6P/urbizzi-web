import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { Dialogo } from '../../components/Dialogo'
import { InputNumerico } from '../../components/InputNumerico'
import { Campo, Spinner } from '../../components/ui'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { rotuloSituacao } from '../../data/catalogos'
import { useDb } from '../../data/db'
import type { Imovel } from '../../data/types'
import { formatarMoedaInteira } from '../../lib/format'
import {
  dataCalendario,
  dataCalendarioValida,
  formatarData,
  instanteExpiracao,
  lerValidade,
  OPCOES_AVISO_HORAS,
  reservaVazia,
  validarReserva,
  type ErrosReserva,
  type FormReserva,
} from '../../lib/reservas'
import { criarReserva } from '../../services/api'

/** "Qd. 04 — Lote 12" ou "Lote 31". */
const rotuloQuadraLote = (i: Imovel) =>
  i.endereco.quadra ? `Qd. ${i.endereco.quadra} — Lote ${i.endereco.lote}` : `Lote ${i.endereco.lote}`

/** Mensagem de bloqueio do imóvel (RF13/RF14), ou undefined se puder ser reservado. */
function bloqueioDoImovel(imovel: Imovel | undefined) {
  if (!imovel) return undefined
  if (imovel.situacao === 'reservado') return 'Já existe uma reserva ativa para este imóvel.'
  if (imovel.situacao !== 'disponivel') return 'Somente imóveis com situação Disponível podem ser reservados.'
  return undefined
}

/** Prazo padrão do imóvel (cadastrado em horas) convertido em dias corridos. */
const validadePadrao = (i: Imovel) => String(Math.max(1, Math.ceil(i.valores.prazoReservaHoras / 24)))

export function NovaReservaPage() {
  const db = useDb()
  const navigate = useNavigate()
  const notificar = useToast()
  const { usuario } = useAuth()
  const [params] = useSearchParams()

  const [iniciais] = useState<FormReserva>(() => {
    const vazio = reservaVazia(dataCalendario(new Date()))
    const imovel = db.imoveis.find((i) => i.id === params.get('imovel'))
    const cliente = db.clientes.find((c) => c.id === params.get('cliente') && c.ativo)
    return {
      ...vazio,
      ...(imovel ? { loteamento: imovel.loteamento, imovelId: imovel.id, validadeDias: validadePadrao(imovel) } : {}),
      ...(cliente ? { clienteId: cliente.id } : {}),
    }
  })
  const [form, setForm] = useState<FormReserva>(iniciais)
  const [tentou, setTentou] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [descartar, setDescartar] = useState(false)

  const imovel = db.imoveis.find((i) => i.id === form.imovelId)
  const loteamento = db.loteamentos.find((l) => l.nome === form.loteamento)
  const cliente = db.clientes.find((c) => c.id === form.clienteId)
  const clientesAtivos = useMemo(
    () => db.clientes.filter((c) => c.ativo).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [db.clientes],
  )
  const imoveisDoLoteamento = useMemo(
    () =>
      db.imoveis
        .filter((i) => i.status === 'publicado' && i.loteamento === form.loteamento)
        .sort((a, b) => rotuloQuadraLote(a).localeCompare(rotuloQuadraLote(b), 'pt-BR', { numeric: true })),
    [db.imoveis, form.loteamento],
  )

  const validade = lerValidade(form.validadeDias)
  const expiraEm = validade !== null && dataCalendarioValida(form.dataInicio) ? instanteExpiracao(form.dataInicio, validade) : null
  const bloqueio = bloqueioDoImovel(imovel)
  const erros: ErrosReserva = validarReserva(form, bloqueio)
  const sujo = (Object.keys(iniciais) as (keyof FormReserva)[]).some((k) => form[k] !== iniciais[k])

  /** Erros aparecem após a primeira tentativa; o bloqueio do imóvel (RF13/RF14) aparece de imediato. */
  const erro = (campo: keyof FormReserva) => (campo === 'imovelId' && bloqueio ? bloqueio : tentou ? erros[campo] : undefined)
  const alterar = (parcial: Partial<FormReserva>) => setForm((f) => ({ ...f, ...parcial }))

  const escolherImovel = (id: string) => {
    const escolhido = db.imoveis.find((i) => i.id === id)
    // O prazo do imóvel vira a validade sugerida enquanto o usuário não alterar o campo.
    const sugerir = escolhido && form.validadeDias === (imovel ? validadePadrao(imovel) : iniciais.validadeDias)
    alterar({ imovelId: id, ...(sugerir ? { validadeDias: validadePadrao(escolhido) } : {}) })
  }

  const criar = async () => {
    setTentou(true)
    if (Object.keys(erros).length) {
      notificar('Revise os campos destacados.', 'erro')
      return
    }
    setSalvando(true)
    try {
      const desconto = form.descontoPercentual.trim()
      const reserva = await criarReserva(
        {
          imovelId: form.imovelId,
          clienteId: form.clienteId,
          corretorId: form.corretorId,
          dataInicio: form.dataInicio,
          validadeDias: validade!,
          avisarHorasAntes: form.avisarHorasAntes,
          sinal: form.sinal,
          formaPagamento: form.formaPagamento,
          descontoPercentual: desconto ? Number(desconto) : null,
          origemInteresse: form.origemInteresse,
          contatoRecente: form.contatoRecente,
          observacoes: form.observacoes,
        },
        usuario?.nome ?? 'Administrador',
      )
      notificar(
        reserva.status === 'ativa'
          ? `Reserva ${reserva.codigo} criada. O imóvel está bloqueado até ${formatarData(reserva.expiraEm)}.`
          : `Reserva ${reserva.codigo} registrada, mas já nasceu expirada pela data inicial informada.`,
        reserva.status === 'ativa' ? 'sucesso' : 'info',
      )
      navigate(`/reservas/${reserva.id}`)
    } catch (e) {
      notificar(e instanceof Error ? e.message : 'Não foi possível criar a reserva.', 'erro')
      setSalvando(false)
    }
  }

  return (
    <>
      <header className="cabecalho cabecalho--fixo">
        <div>
          <nav className="migalhas" aria-label="Você está em">
            <Link to="/reservas">Reservas</Link>
            <span aria-hidden>›</span>
            <span>Nova reserva</span>
          </nav>
          <h1 className="cabecalho__titulo">Nova reserva</h1>
          <p className="cabecalho__subtitulo">Bloqueia o imóvel por um prazo determinado · RF13, RF14 e RF15</p>
        </div>
        <div className="cabecalho__acoes">
          <button type="button" className="btn btn--secundario" onClick={() => (sujo ? setDescartar(true) : navigate('/reservas'))}>
            Cancelar
          </button>
          <button type="button" className="btn btn--primario" onClick={criar} disabled={salvando}>
            {salvando && <Spinner />} Criar reserva
          </button>
        </div>
      </header>

      <main className="conteudo pilha">
        <section className="card secao">
          <div className="secao__cabecalho">
            <h2 className="card__titulo">Imóvel</h2>
            <p className="card__subtitulo">Somente imóveis com situação Disponível podem ser reservados.</p>
          </div>
          <div className="grade">
            <Campo rotulo="Loteamento" erro={erro('loteamento')} className="c-3">
              {(p) => (
                <select {...p} className="input select" value={form.loteamento} onChange={(e) => alterar({ loteamento: e.target.value, imovelId: '' })}>
                  <option value="">Selecione</option>
                  {db.loteamentos.map((l) => <option key={l.id}>{l.nome}</option>)}
                </select>
              )}
            </Campo>
            <Campo rotulo="Quadra / Lote" erro={erro('imovelId')} className="c-3">
              {(p) => (
                <select {...p} className="input select" value={form.imovelId} disabled={!form.loteamento} onChange={(e) => escolherImovel(e.target.value)}>
                  <option value="">Selecione</option>
                  {imoveisDoLoteamento.map((i) => (
                    <option key={i.id} value={i.id}>
                      {rotuloQuadraLote(i)}
                      {i.situacao !== 'disponivel' ? ` (${rotuloSituacao(i.situacao)})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </Campo>
            <Campo rotulo="Matrícula" className="c-2">
              {(p) => <input {...p} className="input" readOnly placeholder="—" value={imovel ? imovel.matricula || 'Pendente' : ''} />}
            </Campo>
            <Campo rotulo="Situação atual" className="c-2">
              {(p) => <input {...p} className="input" readOnly placeholder="—" value={imovel ? rotuloSituacao(imovel.situacao) : ''} />}
            </Campo>
            <Campo rotulo="Valor de tabela" className="c-2">
              {(p) => <input {...p} className="input" readOnly placeholder="—" value={imovel?.valores.tabela ? formatarMoedaInteira(imovel.valores.tabela) : ''} />}
            </Campo>
          </div>
          <p className="nota-regra">RF14 — o sistema impede a criação se já existir uma reserva ativa para este imóvel.</p>
        </section>

        <section className="card secao">
          <div className="secao__cabecalho">
            <h2 className="card__titulo">Cliente e responsável</h2>
            <p className="card__subtitulo">A reserva precisa estar vinculada a um cliente ativo do cadastro.</p>
          </div>
          <div className="grade">
            <Campo rotulo="Cliente" erro={erro('clienteId')} className="c-6">
              {(p) => (
                <select {...p} className="input select" value={form.clienteId} onChange={(e) => alterar({ clienteId: e.target.value })}>
                  <option value="">Selecione</option>
                  {clientesAtivos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              )}
            </Campo>
            <Campo rotulo="CPF / CNPJ" className="c-3">
              {(p) => <input {...p} className="input" readOnly placeholder="—" value={cliente?.cpfCnpj ?? ''} />}
            </Campo>
            <Campo rotulo="Telefone" className="c-3">
              {(p) => <input {...p} className="input" readOnly placeholder="—" value={cliente?.telefone ?? ''} />}
            </Campo>
            {clientesAtivos.length === 0 && (
              <p className="c-12 campo__dica">
                Nenhum cliente ativo cadastrado. <Link to="/clientes/novo" className="link">Cadastrar cliente</Link>
              </p>
            )}
            <Campo rotulo="Responsável comercial" erro={erro('corretorId')} className="c-3">
              {(p) => (
                <select {...p} className="input select" value={form.corretorId} onChange={(e) => alterar({ corretorId: e.target.value })}>
                  <option value="">Selecione</option>
                  {db.corretores.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              )}
            </Campo>
            <Campo rotulo="Origem do interesse" className="c-4">
              {(p) => <input {...p} className="input" placeholder="Ex.: Catálogo público" value={form.origemInteresse} onChange={(e) => alterar({ origemInteresse: e.target.value })} />}
            </Campo>
            <Campo rotulo="Contato mais recente" className="c-5">
              {(p) => <input {...p} className="input" placeholder="Ex.: 22/08 · WhatsApp" value={form.contatoRecente} onChange={(e) => alterar({ contatoRecente: e.target.value })} />}
            </Campo>
          </div>
        </section>

        <section className="card secao">
          <div className="secao__cabecalho">
            <h2 className="card__titulo">Prazo da reserva</h2>
            <p className="card__subtitulo">Validade em dias corridos a partir da data inicial; a sugestão vem do prazo cadastrado no imóvel.</p>
          </div>
          <div className="grade">
            <Campo rotulo="Data inicial" erro={erro('dataInicio')} className="c-3">
              {(p) => <input {...p} type="date" className="input" value={form.dataInicio} onChange={(e) => alterar({ dataInicio: e.target.value })} />}
            </Campo>
            <Campo rotulo="Validade (dias)" erro={erro('validadeDias')} className="c-2">
              {(p) => (
                <input {...p} type="number" inputMode="numeric" min={1} step={1} className="input" value={form.validadeDias} onChange={(e) => alterar({ validadeDias: e.target.value })} />
              )}
            </Campo>
            <Campo rotulo="Expira em" className="c-2">
              {(p) => <input {...p} className="input" readOnly placeholder="—" value={expiraEm ? formatarData(expiraEm) : ''} />}
            </Campo>
            <Campo rotulo="Renovações permitidas" className="c-2">
              {(p) => <input {...p} className="input" readOnly placeholder="—" value={loteamento ? String(loteamento.limiteRenovacoes) : ''} />}
            </Campo>
            <Campo rotulo="Avisar responsável" className="c-3">
              {(p) => (
                <select {...p} className="input select" value={form.avisarHorasAntes} onChange={(e) => alterar({ avisarHorasAntes: Number(e.target.value) })}>
                  {OPCOES_AVISO_HORAS.map((h) => (
                    <option key={h} value={h}>
                      {h}h antes
                    </option>
                  ))}
                </select>
              )}
            </Campo>
          </div>
          <p className="nota-regra">
            RF16 — ao chegar na data de expiração sem renovação, a reserva expira sozinha e o imóvel volta para Disponível.
          </p>
        </section>

        <section className="card secao">
          <div className="secao__cabecalho">
            <h2 className="card__titulo">Condições e observações</h2>
            <p className="card__subtitulo">Informações que alimentam a proposta comercial gerada a partir desta reserva.</p>
          </div>
          <div className="grade">
            <Campo rotulo="Sinal acordado" className="c-3">
              {(p) => <InputNumerico {...p} prefixo="R$" valor={form.sinal} onChange={(sinal) => alterar({ sinal })} />}
            </Campo>
            <Campo rotulo="Forma de pagamento" className="c-4">
              {(p) => <input {...p} className="input" placeholder="Ex.: Entrada + 24x" value={form.formaPagamento} onChange={(e) => alterar({ formaPagamento: e.target.value })} />}
            </Campo>
            <Campo rotulo="Desconto pretendido (%)" erro={erro('descontoPercentual')} className="c-2">
              {(p) => (
                <input
                  {...p}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={100}
                  step={0.5}
                  className="input"
                  placeholder="0"
                  value={form.descontoPercentual}
                  onChange={(e) => alterar({ descontoPercentual: e.target.value })}
                />
              )}
            </Campo>
            <Campo rotulo="Observações" className="c-12">
              {(p) => (
                <textarea
                  {...p}
                  rows={2}
                  className="input input--area"
                  placeholder="Ex.: Cliente pediu simulação em 120x."
                  value={form.observacoes}
                  onChange={(e) => alterar({ observacoes: e.target.value })}
                />
              )}
            </Campo>
          </div>
        </section>
      </main>

      <Dialogo
        aberto={descartar}
        titulo="Descartar a reserva?"
        descricao="Existem campos preenchidos. Os dados informados serão perdidos."
        textoConfirmar="Descartar"
        textoCancelar="Continuar editando"
        perigoso
        onCancelar={() => setDescartar(false)}
        onConfirmar={() => navigate('/reservas')}
      />
    </>
  )
}
