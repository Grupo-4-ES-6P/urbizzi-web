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
import { formatarData } from '../../lib/reservas'
import { useAgora } from '../../lib/useAgora'
import { responsaveisComerciais } from '../../lib/usuarios'
import { hojeCalendario, impedimentoVenda, STATUS_VENDA, validarVenda, vendaVazia, type FormVenda } from '../../lib/vendas'
import { registrarVenda } from '../../services/vendas'

/** "Qd. 04 — Lote 12" ou "Lote 31". */
const rotuloQuadraLote = (i: Imovel) =>
  i.endereco.quadra ? `Qd. ${i.endereco.quadra} — Lote ${i.endereco.lote}` : `Lote ${i.endereco.lote}`

const STATUS_INICIAIS: FormVenda['status'][] = ['em_escritura', 'concluida']

export function NovaVendaPage() {
  const db = useDb()
  const agora = useAgora()
  const navigate = useNavigate()
  const notificar = useToast()
  const { usuario } = useAuth()
  const [params] = useSearchParams()
  const hoje = hojeCalendario()

  const [iniciais] = useState<FormVenda>(() => {
    const imovel = db.imoveis.find((i) => i.id === params.get('imovel'))
    return { ...vendaVazia(hoje), ...(imovel ? { loteamento: imovel.loteamento, imovelId: imovel.id } : {}) }
  })
  const [form, setForm] = useState<FormVenda>(iniciais)
  const [tentou, setTentou] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [descartar, setDescartar] = useState(false)

  const imovel = db.imoveis.find((i) => i.id === form.imovelId)
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

  const impedimento = form.imovelId ? impedimentoVenda(db, form.imovelId, form.clienteId, agora) : undefined
  const erros = validarVenda(form, hoje, impedimento)
  const sujo = (Object.keys(iniciais) as (keyof FormVenda)[]).some((k) => form[k] !== iniciais[k])

  /** Erros aparecem após a primeira tentativa; o impedimento do imóvel aparece de imediato. */
  const erro = (campo: keyof FormVenda) => (campo === 'imovelId' && impedimento ? impedimento : tentou ? erros[campo] : undefined)
  const alterar = (parcial: Partial<FormVenda>) => setForm((f) => ({ ...f, ...parcial }))

  /** Uma reserva ativa sugere comprador e corretor; o valor de tabela sugere o valor da venda. */
  const escolherImovel = (id: string) => {
    const escolhido = db.imoveis.find((i) => i.id === id)
    const reserva = db.reservas.find(
      (r) => r.imovelId === id && r.status === 'ativa' && new Date(r.expiraEm).getTime() > agora,
    )
    alterar({
      imovelId: id,
      ...(reserva && !form.clienteId ? { clienteId: reserva.clienteId } : {}),
      ...(reserva && !form.corretorId ? { corretorId: reserva.corretorId } : {}),
      ...(escolhido?.valores.tabela && form.valor === null ? { valor: escolhido.valores.tabela } : {}),
    })
  }

  const registrar = async () => {
    setTentou(true)
    if (Object.keys(erros).length) {
      notificar('Revise os campos destacados.', 'erro')
      return
    }
    setSalvando(true)
    try {
      const venda = await registrarVenda(
        {
          imovelId: form.imovelId,
          clienteId: form.clienteId,
          corretorId: form.corretorId,
          valor: form.valor!,
          data: form.data,
          status: form.status,
        },
        { nome: usuario?.nome ?? 'Administrador', papel: usuario?.papel ?? '' },
      )
      notificar(`Venda ${venda.codigo} registrada em ${formatarData(venda.data)}. O imóvel agora está Vendido.`)
      navigate(`/vendas/${venda.id}`)
    } catch (e) {
      notificar(e instanceof Error ? e.message : 'Não foi possível registrar a venda.', 'erro')
      setSalvando(false)
    }
  }

  return (
    <>
      <header className="cabecalho cabecalho--fixo">
        <div>
          <nav className="migalhas" aria-label="Você está em">
            <Link to="/vendas">Vendas</Link>
            <span aria-hidden>›</span>
            <span>Registrar venda</span>
          </nav>
          <h1 className="cabecalho__titulo">Registrar venda</h1>
          <p className="cabecalho__subtitulo">Registro manual · propostas aprovadas já registram a venda automaticamente</p>
        </div>
        <div className="cabecalho__acoes">
          <button type="button" className="btn btn--secundario" onClick={() => (sujo ? setDescartar(true) : navigate('/vendas'))}>
            Cancelar
          </button>
          <button type="button" className="btn btn--primario" onClick={registrar} disabled={salvando}>
            {salvando && <Spinner />} Registrar venda
          </button>
        </div>
      </header>

      <main className="conteudo pilha">
        <section className="card secao">
          <div className="secao__cabecalho">
            <h2 className="card__titulo">Imóvel</h2>
            <p className="card__subtitulo">Imóveis vendidos, bloqueados ou com proposta em andamento não podem receber uma venda.</p>
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
          <p className="nota-regra">Ao registrar, o imóvel passa a Vendido e a reserva ativa do comprador, se houver, é convertida.</p>
        </section>

        <section className="card secao">
          <div className="secao__cabecalho">
            <h2 className="card__titulo">Comprador e corretor</h2>
            <p className="card__subtitulo">O comprador precisa ser um cliente ativo do cadastro.</p>
          </div>
          <div className="grade">
            <Campo rotulo="Comprador" erro={erro('clienteId')} className="c-6">
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
            <Campo rotulo="Corretor" erro={erro('corretorId')} className="c-3">
              {(p) => (
                <select {...p} className="input select" value={form.corretorId} onChange={(e) => alterar({ corretorId: e.target.value })}>
                  <option value="">Selecione</option>
                  {responsaveisComerciais(db.usuarios, db.permissoes).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              )}
            </Campo>
          </div>
        </section>

        <section className="card secao">
          <div className="secao__cabecalho">
            <h2 className="card__titulo">Venda</h2>
            <p className="card__subtitulo">O registro e cada mudança de status ficam na auditoria da venda.</p>
          </div>
          <div className="grade">
            <Campo rotulo="Valor da venda" erro={erro('valor')} className="c-4">
              {(p) => <InputNumerico {...p} prefixo="R$" valor={form.valor} onChange={(valor) => alterar({ valor })} />}
            </Campo>
            <Campo rotulo="Data da venda" erro={erro('data')} className="c-4">
              {(p) => <input {...p} type="date" className="input" max={hoje} value={form.data} onChange={(e) => alterar({ data: e.target.value })} />}
            </Campo>
            <Campo rotulo="Status inicial" className="c-4">
              {(p) => (
                <select {...p} className="input select" value={form.status} onChange={(e) => alterar({ status: STATUS_INICIAIS.find((s) => s === e.target.value) ?? 'em_escritura' })}>
                  {STATUS_INICIAIS.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_VENDA[s].rotulo}
                    </option>
                  ))}
                </select>
              )}
            </Campo>
          </div>
        </section>
      </main>

      <Dialogo
        aberto={descartar}
        titulo="Descartar a venda?"
        descricao="Existem campos preenchidos. Os dados informados serão perdidos."
        textoConfirmar="Descartar"
        textoCancelar="Continuar editando"
        perigoso
        onCancelar={() => setDescartar(false)}
        onConfirmar={() => navigate('/vendas')}
      />
    </>
  )
}
