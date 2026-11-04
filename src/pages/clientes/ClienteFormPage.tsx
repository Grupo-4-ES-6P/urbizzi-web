import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { Dialogo } from '../../components/Dialogo'
import { Badge, Campo, Spinner, Toggle } from '../../components/ui'
import { useToast } from '../../contexts/ToastContext'
import { UFS } from '../../data/catalogos'
import { useDb } from '../../data/db'
import { indexar, rotuloImovel } from '../../data/selectors'
import type { Cliente, EnderecoCliente, TipoPessoa } from '../../data/types'
import {
  clienteVazio,
  ESTADOS_CIVIS,
  formDeCliente,
  mascaraCpfCnpj,
  mascaraTelefone,
  validarCliente,
  type ErrosCliente,
  type FormCliente,
} from '../../lib/clienteForm'
import { mascaraCep } from '../../lib/format'
import { classificarReserva, formatarData, SITUACAO_RESERVA } from '../../lib/reservas'
import { useAgora } from '../../lib/useAgora'
import { buscarCep, salvarCliente } from '../../services/api'

export function ClienteFormPage() {
  const { id } = useParams()
  const db = useDb()
  const cliente = id ? db.clientes.find((c) => c.id === id) : undefined
  if (id && !cliente) {
    return (
      <main className="conteudo">
        <section className="card vazio">
          <h2>Cliente não encontrado</h2>
          <p>Ele pode ter sido excluído.</p>
          <Link to="/clientes" className="btn btn--secundario">
            Voltar para clientes
          </Link>
        </section>
      </main>
    )
  }
  return <FormularioCliente key={id ?? 'novo'} cliente={cliente} />
}

function FormularioCliente({ cliente }: { cliente?: Cliente }) {
  const navigate = useNavigate()
  const notificar = useToast()
  const [form, setForm] = useState<FormCliente>(() => (cliente ? formDeCliente(cliente) : clienteVazio()))
  const [erros, setErros] = useState<ErrosCliente>({})
  const [sujo, setSujo] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [dialogo, setDialogo] = useState<'descartar' | 'limpar' | null>(null)
  const [buscandoCep, setBuscandoCep] = useState(false)

  const limparErros = (...campos: (keyof ErrosCliente)[]) =>
    setErros((e) => {
      const c = { ...e }
      for (const k of campos) delete c[k]
      return c
    })

  const alterar = (parcial: Partial<FormCliente>) => {
    setForm((f) => ({ ...f, ...parcial }))
    setSujo(true)
    // Telefone e e-mail compartilham a regra "pelo menos um".
    const campos = Object.keys(parcial) as (keyof ErrosCliente)[]
    limparErros(...campos, ...(campos.some((c) => c === 'telefone' || c === 'email') ? (['telefone', 'email'] as const) : []))
  }

  const alterarEndereco = (parcial: Partial<EnderecoCliente>) => {
    setForm((f) => ({ ...f, endereco: { ...f.endereco, ...parcial } }))
    setSujo(true)
    limparErros(...(Object.keys(parcial).map((k) => `endereco.${k}`) as (keyof ErrosCliente)[]))
  }

  const alterarTipo = (tipoPessoa: TipoPessoa) =>
    alterar({
      tipoPessoa,
      cpfCnpj: mascaraCpfCnpj(form.cpfCnpj, tipoPessoa),
      ...(tipoPessoa === 'juridica' ? { estadoCivil: '', profissao: '', dataNascimento: '' } : {}),
    })

  const alterarCep = async (valor: string) => {
    const cep = mascaraCep(valor)
    alterarEndereco({ cep })
    if (cep.length !== 9) return
    setBuscandoCep(true)
    try {
      const end = await buscarCep(cep)
      if (end) {
        alterarEndereco({
          ...(end.logradouro ? { logradouro: end.logradouro } : {}),
          ...(end.bairro ? { bairro: end.bairro } : {}),
          cidade: end.cidade,
          uf: end.uf,
        })
      }
    } catch {
      // Sem internet: segue com preenchimento manual.
    } finally {
      setBuscandoCep(false)
    }
  }

  const salvar = async () => {
    const e = validarCliente(form)
    setErros(e)
    if (Object.keys(e).length) {
      notificar('Revise os campos destacados.', 'erro')
      return
    }
    setSalvando(true)
    try {
      await salvarCliente({ ...form, id: cliente?.id })
      setSujo(false)
      notificar(cliente ? 'Cliente atualizado.' : 'Cliente cadastrado.')
      navigate('/clientes')
    } catch (err) {
      notificar(err instanceof Error ? err.message : 'Não foi possível salvar.', 'erro')
    } finally {
      setSalvando(false)
    }
  }

  const fisica = form.tipoPessoa === 'fisica'
  const fim = form.endereco

  return (
    <>
      <header className="cabecalho cabecalho--fixo">
        <div>
          <nav className="migalhas" aria-label="Você está em">
            <Link to="/clientes">Clientes</Link>
            <span aria-hidden>›</span>
            <span>{cliente ? cliente.nome : 'Novo cliente'}</span>
          </nav>
          <h1 className="cabecalho__titulo">{cliente ? 'Editar cliente' : 'Novo cliente'}</h1>
          <p className="cabecalho__subtitulo">
            {cliente ? 'Atualize os dados de identificação, contato e endereço.' : 'Cadastre o cliente para vinculá-lo a reservas e propostas.'}
          </p>
        </div>
        <div className="cabecalho__acoes">
          <button type="button" className="btn btn--secundario" onClick={() => (sujo ? setDialogo('descartar') : navigate('/clientes'))}>
            Cancelar
          </button>
          <button type="button" className="btn btn--secundario" onClick={() => setDialogo('limpar')}>
            Limpar
          </button>
          <button type="button" className="btn btn--primario" onClick={salvar} disabled={salvando}>
            {salvando && <Spinner />} {cliente ? 'Salvar alterações' : 'Salvar cliente'}
          </button>
        </div>
      </header>

      <main className="conteudo pilha">
        <section className="card secao">
          <div className="secao__cabecalho">
            <h2 className="card__titulo">Identificação</h2>
            <p className="card__subtitulo">Dados que identificam o cliente no cadastro.</p>
          </div>
          <div className="grade">
            <Campo rotulo="Nome completo / Razão social" erro={erros.nome} className="c-6">
              {(p) => <input {...p} className="input" placeholder="Ex.: Maria da Silva" value={form.nome} onChange={(e) => alterar({ nome: e.target.value })} />}
            </Campo>
            <Campo rotulo="Tipo de pessoa" className="c-3">
              {(p) => (
                <select {...p} className="input select" value={form.tipoPessoa} onChange={(e) => alterarTipo(e.target.value as TipoPessoa)}>
                  <option value="fisica">Pessoa física</option>
                  <option value="juridica">Pessoa jurídica</option>
                </select>
              )}
            </Campo>
            <Campo rotulo={fisica ? 'CPF' : 'CNPJ'} erro={erros.cpfCnpj} className="c-3">
              {(p) => (
                <input
                  {...p}
                  className="input"
                  inputMode="numeric"
                  placeholder={fisica ? '000.000.000-00' : '00.000.000/0000-00'}
                  value={form.cpfCnpj}
                  onChange={(e) => alterar({ cpfCnpj: mascaraCpfCnpj(e.target.value, form.tipoPessoa) })}
                />
              )}
            </Campo>
            {fisica && (
              <>
                <Campo rotulo="Data de nascimento" erro={erros.dataNascimento} className="c-3">
                  {(p) => <input {...p} type="date" className="input" value={form.dataNascimento} onChange={(e) => alterar({ dataNascimento: e.target.value })} />}
                </Campo>
                <Campo rotulo="Estado civil" className="c-3">
                  {(p) => (
                    <select {...p} className="input select" value={form.estadoCivil} onChange={(e) => alterar({ estadoCivil: e.target.value })}>
                      <option value="">Selecione</option>
                      {ESTADOS_CIVIS.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  )}
                </Campo>
                <Campo rotulo="Profissão" className="c-3">
                  {(p) => <input {...p} className="input" placeholder="Ex.: Engenheira civil" value={form.profissao} onChange={(e) => alterar({ profissao: e.target.value })} />}
                </Campo>
              </>
            )}
            <div className={`${fisica ? 'c-3' : 'c-6'} grade__botao`}>
              <Toggle rotulo={form.ativo ? 'Cadastro ativo' : 'Cadastro inativo'} ativo={form.ativo} onChange={(ativo) => alterar({ ativo })} />
            </div>
          </div>
        </section>

        <section className="card secao">
          <div className="secao__cabecalho">
            <h2 className="card__titulo">Contato</h2>
            <p className="card__subtitulo">Pelo menos um telefone ou e-mail é obrigatório.</p>
          </div>
          <div className="grade">
            <Campo rotulo="Telefone" erro={erros.telefone} className="c-6">
              {(p) => <input {...p} type="tel" className="input" placeholder="(45) 99812-4477" value={form.telefone} onChange={(e) => alterar({ telefone: mascaraTelefone(e.target.value) })} />}
            </Campo>
            <Campo rotulo="E-mail" erro={erros.email} className="c-6">
              {(p) => <input {...p} type="email" className="input" placeholder="nome@email.com" value={form.email} onChange={(e) => alterar({ email: e.target.value })} />}
            </Campo>
          </div>
        </section>

        <section className="card secao">
          <div className="secao__cabecalho">
            <h2 className="card__titulo">Endereço</h2>
            <p className="card__subtitulo">Preenchimento automático a partir do CEP.</p>
          </div>
          <div className="grade">
            <Campo rotulo="CEP" erro={erros['endereco.cep']} dica={buscandoCep ? 'Buscando endereço…' : undefined} className="c-2">
              {(p) => <input {...p} className="input" inputMode="numeric" placeholder="85900-000" value={fim.cep} onChange={(e) => alterarCep(e.target.value)} />}
            </Campo>
            <Campo rotulo="Logradouro" erro={erros['endereco.logradouro']} className="c-5">
              {(p) => <input {...p} className="input" placeholder="Ex.: Rua Barão do Rio Branco" value={fim.logradouro} onChange={(e) => alterarEndereco({ logradouro: e.target.value })} />}
            </Campo>
            <Campo rotulo="Número" className="c-2">
              {(p) => <input {...p} className="input" placeholder="123" value={fim.numero} onChange={(e) => alterarEndereco({ numero: e.target.value })} />}
            </Campo>
            <Campo rotulo="Complemento" className="c-3">
              {(p) => <input {...p} className="input" placeholder="Opcional" value={fim.complemento} onChange={(e) => alterarEndereco({ complemento: e.target.value })} />}
            </Campo>
            <Campo rotulo="Bairro" erro={erros['endereco.bairro']} className="c-4">
              {(p) => <input {...p} className="input" value={fim.bairro} onChange={(e) => alterarEndereco({ bairro: e.target.value })} />}
            </Campo>
            <Campo rotulo="Cidade" erro={erros['endereco.cidade']} className="c-4">
              {(p) => <input {...p} className="input" value={fim.cidade} onChange={(e) => alterarEndereco({ cidade: e.target.value })} />}
            </Campo>
            <Campo rotulo="UF" erro={erros['endereco.uf']} className="c-1">
              {(p) => (
                <select {...p} className="input select" value={fim.uf} onChange={(e) => alterarEndereco({ uf: e.target.value })}>
                  <option value="">—</option>
                  {UFS.map((u) => <option key={u}>{u}</option>)}
                </select>
              )}
            </Campo>
            <Campo rotulo="País" erro={erros['endereco.pais']} className="c-3">
              {(p) => <input {...p} className="input" value={fim.pais} onChange={(e) => alterarEndereco({ pais: e.target.value })} />}
            </Campo>
          </div>
        </section>

        {cliente && <ReservasDoCliente clienteId={cliente.id} />}
      </main>

      <Dialogo
        aberto={dialogo !== null}
        titulo={dialogo === 'limpar' ? 'Limpar todos os campos?' : 'Descartar alterações?'}
        descricao={dialogo === 'limpar' ? 'Os dados preenchidos neste formulário serão apagados.' : 'As informações não salvas serão perdidas.'}
        textoConfirmar={dialogo === 'limpar' ? 'Limpar' : 'Descartar'}
        textoCancelar="Continuar editando"
        perigoso
        onCancelar={() => setDialogo(null)}
        onConfirmar={() => {
          if (dialogo === 'descartar') {
            navigate('/clientes')
            return
          }
          setForm(clienteVazio())
          setErros({})
          setSujo(true)
          setDialogo(null)
        }}
      />
    </>
  )
}

function ReservasDoCliente({ clienteId }: { clienteId: string }) {
  const db = useDb()
  const agora = useAgora()
  const imoveis = indexar(db.imoveis)
  const reservas = db.reservas.filter((r) => r.clienteId === clienteId).sort((a, b) => b.criadaEm.localeCompare(a.criadaEm))

  return (
    <section className="card">
      <div className="card__cabecalho">
        <div>
          <h2 className="card__titulo">Reservas do cliente</h2>
          <p className="card__subtitulo">Reservas atuais e encerradas vinculadas a este cadastro</p>
        </div>
        <Link to={`/reservas/nova?cliente=${clienteId}`} className="btn btn--secundario btn--pequeno">
          Nova reserva
        </Link>
      </div>
      {reservas.length === 0 ? (
        <p className="card__vazio">Nenhuma reserva para este cliente.</p>
      ) : (
        <div className="tabela-wrap">
          <table className="tabela">
            <thead>
              <tr>
                <th>Reserva</th>
                <th>Imóvel</th>
                <th>Criada em</th>
                <th>Expira em</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {reservas.map((r) => {
                const imovel = imoveis.get(r.imovelId)
                const s = SITUACAO_RESERVA[classificarReserva(r, agora)]
                return (
                  <tr key={r.id}>
                    <td className="tabela__destaque">
                      <Link to={`/reservas/${r.id}`}>{r.codigo}</Link>
                    </td>
                    <td>{imovel ? rotuloImovel(imovel) : '—'}</td>
                    <td>{formatarData(r.dataInicio)}</td>
                    <td>{formatarData(r.expiraEm)}</td>
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
  )
}
