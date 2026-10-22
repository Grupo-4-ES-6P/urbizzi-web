import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { Dialogo } from '../../components/Dialogo'
import { Badge, Campo, Spinner, Toggle } from '../../components/ui'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { UFS } from '../../data/catalogos'
import { useDb } from '../../data/db'
import { indexar, rotuloImovel } from '../../data/selectors'
import type { CanalContato, Cliente, ContatoComercial, EnderecoCliente, Imovel, ResultadoContato, TipoPessoa } from '../../data/types'
import { CANAIS_CONTATO, ordenarContatos, ORIGENS_CLIENTE, RESULTADO_CONTATO, RESULTADOS_CONTATO } from '../../lib/clientes'
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
import { useAgora } from '../../lib/useAgora'
import { buscarCep, novoId, salvarCliente } from '../../services/api'

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
  const db = useDb()
  const { usuario } = useAuth()
  const [form, setForm] = useState<FormCliente>(() => (cliente ? formDeCliente(cliente) : clienteVazio()))
  const [erros, setErros] = useState<ErrosCliente>({})
  const [sujo, setSujo] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [dialogo, setDialogo] = useState<'descartar' | 'limpar' | null>(null)
  const [buscandoCep, setBuscandoCep] = useState(false)
  const [registrandoContato, setRegistrandoContato] = useState(false)

  const imoveis = useMemo(() => indexar(db.imoveis), [db.imoveis])
  // Quem pode responder pelo cliente: usuários, corretores e responsáveis já usados nos cadastros.
  const responsaveis = useMemo(
    () =>
      [
        ...new Set(
          [...db.usuarios.map((u) => u.nome), ...db.corretores.map((c) => c.nome), ...db.clientes.map((c) => c.responsavel), form.responsavel].filter(
            Boolean,
          ),
        ),
      ].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [db.usuarios, db.corretores, db.clientes, form.responsavel],
  )
  // Imóveis livres para interesse, mais o já escolhido (que pode ter sido reservado depois).
  const imoveisInteresse = useMemo(
    () =>
      db.imoveis
        .filter((i) => i.situacao === 'disponivel' || i.id === form.imovelInteresseId)
        .sort((a, b) => rotuloImovel(a).localeCompare(rotuloImovel(b), 'pt-BR', { numeric: true })),
    [db.imoveis, form.imovelInteresseId],
  )

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
    const contato = ['telefone', 'celular', 'email'] as const
    limparErros(...campos, ...(campos.some((c) => (contato as readonly string[]).includes(c)) ? contato : []))
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

  const adicionarContato = (contato: ContatoComercial) => {
    alterar({ contatos: ordenarContatos([contato, ...form.contatos]) })
    setRegistrandoContato(false)
    notificar('Contato registrado. Salve o cliente para gravar.')
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
          <p className="cabecalho__subtitulo">Cadastro do comprador e histórico de contatos comerciais · RF11 e RF12</p>
        </div>
        <div className="cabecalho__acoes">
          <button type="button" className="btn btn--secundario" onClick={() => (sujo ? setDialogo('descartar') : navigate('/clientes'))}>
            Cancelar
          </button>
          <button type="button" className="btn btn--secundario" onClick={() => setDialogo('limpar')}>
            Limpar
          </button>
          <button type="button" className="btn btn--secundario" onClick={() => setRegistrandoContato(true)}>
            Registrar contato
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
            <p className="card__subtitulo">Pessoa física ou jurídica. O CPF ou CNPJ não pode se repetir no sistema.</p>
          </div>
          <div className="grade">
            <Campo rotulo="Tipo de pessoa" className="c-3">
              {(p) => (
                <select {...p} className="input select" value={form.tipoPessoa} onChange={(e) => alterarTipo(e.target.value as TipoPessoa)}>
                  <option value="fisica">Pessoa física</option>
                  <option value="juridica">Pessoa jurídica</option>
                </select>
              )}
            </Campo>
            <Campo rotulo="Nome completo / Razão social" erro={erros.nome} className="c-6">
              {(p) => <input {...p} className="input" placeholder="Ex.: Maria da Silva" value={form.nome} onChange={(e) => alterar({ nome: e.target.value })} />}
            </Campo>
            <Campo rotulo="CPF / CNPJ" erro={erros.cpfCnpj} className="c-3">
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
            <Campo rotulo={fisica ? 'RG' : 'Inscrição estadual'} className="c-3">
              {(p) => <input {...p} className="input" placeholder={fisica ? '12.864.301-9' : 'Opcional'} value={form.rg} onChange={(e) => alterar({ rg: e.target.value })} />}
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
            <div className="c-3 grade__botao">
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
            <Campo rotulo="E-mail" erro={erros.email} className="c-6">
              {(p) => <input {...p} type="email" className="input" placeholder="nome@email.com" value={form.email} onChange={(e) => alterar({ email: e.target.value })} />}
            </Campo>
            <Campo rotulo="Telefone" erro={erros.telefone} className="c-3">
              {(p) => <input {...p} type="tel" className="input" placeholder="(45) 3055-1180" value={form.telefone} onChange={(e) => alterar({ telefone: mascaraTelefone(e.target.value) })} />}
            </Campo>
            <Campo rotulo="Celular / WhatsApp" erro={erros.celular} className="c-3">
              {(p) => <input {...p} type="tel" className="input" placeholder="(45) 99812-4477" value={form.celular} onChange={(e) => alterar({ celular: mascaraTelefone(e.target.value) })} />}
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

        <section className="card secao">
          <div className="secao__cabecalho">
            <h2 className="card__titulo">Origem e responsável</h2>
            <p className="card__subtitulo">De onde veio o cliente e quem responde por ele.</p>
          </div>
          <div className="grade">
            <Campo rotulo="Origem do cadastro" className="c-3">
              {(p) => (
                <select {...p} className="input select" value={form.origem} onChange={(e) => alterar({ origem: e.target.value })}>
                  <option value="">Selecione</option>
                  {ORIGENS_CLIENTE.map((o) => <option key={o}>{o}</option>)}
                </select>
              )}
            </Campo>
            <Campo rotulo="Responsável comercial" className="c-3">
              {(p) => (
                <select {...p} className="input select" value={form.responsavel} onChange={(e) => alterar({ responsavel: e.target.value })}>
                  <option value="">Selecione</option>
                  {responsaveis.map((r) => <option key={r}>{r}</option>)}
                </select>
              )}
            </Campo>
            <Campo rotulo="Imóvel de interesse" className="c-6">
              {(p) => (
                <select {...p} className="input select" value={form.imovelInteresseId} onChange={(e) => alterar({ imovelInteresseId: e.target.value })}>
                  <option value="">Nenhum por enquanto</option>
                  {imoveisInteresse.map((i) => (
                    <option key={i.id} value={i.id}>
                      {rotuloImovel(i)}
                    </option>
                  ))}
                </select>
              )}
            </Campo>
          </div>
        </section>

        <ContatosComerciais contatos={form.contatos} imoveis={imoveis} onRegistrar={() => setRegistrandoContato(true)} />

        {cliente && <ReservasDoCliente clienteId={cliente.id} />}
      </main>

      {registrandoContato && (
        <RegistrarContato
          responsaveis={responsaveis}
          imoveis={imoveisInteresse}
          inicial={{ responsavel: usuario?.nome ?? form.responsavel, imovelId: form.imovelInteresseId }}
          onCancelar={() => setRegistrandoContato(false)}
          onRegistrar={adicionarContato}
        />
      )}

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
      {0 === 0 ? (
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
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

interface ContatosComerciaisProps {
  contatos: ContatoComercial[]
  imoveis: Map<string, Imovel>
  onRegistrar: () => void
}

/** Histórico de interações com o cliente (RF12). */
function ContatosComerciais({ contatos, imoveis, onRegistrar }: Readonly<ContatosComerciaisProps>) {
  const nomeImovel = (id: string) => {
    const imovel = id ? imoveis.get(id) : undefined
    return imovel ? rotuloImovel(imovel, false) : '—'
  }
  return (
    <section className="card">
      <div className="card__cabecalho">
        <div>
          <h2 className="card__titulo">Contatos comerciais</h2>
          <p className="card__subtitulo">Cada interação com o cliente fica registrada com data, canal, responsável e resultado.</p>
        </div>
      </div>
      {contatos.length === 0 ? (
        <p className="card__vazio">
          Nenhum contato registrado.{' '}
          <button type="button" className="link" onClick={onRegistrar}>
            Registrar o primeiro contato
          </button>
        </p>
      ) : (
        <div className="tabela-wrap">
          <table className="tabela" aria-label="Contatos comerciais">
            <thead>
              <tr>
                <th>Data</th>
                <th>Canal</th>
                <th>Responsável</th>
                <th>Imóvel</th>
                <th>Assunto</th>
                <th>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {contatos.map((c) => {
                const resultado = RESULTADO_CONTATO[c.resultado]
                return (
                  <tr key={c.id}>
                    <td className="tabela__destaque">{'10/10/10'}</td>
                    <td>{c.canal}</td>
                    <td>{c.responsavel || '—'}</td>
                    <td>{nomeImovel(c.imovelId)}</td>
                    <td>{c.assunto}</td>
                    <td>
                      <Badge variante={resultado.variante}>{resultado.rotulo}</Badge>
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

interface RegistrarContatoProps {
  responsaveis: string[]
  imoveis: Imovel[]
  inicial: { responsavel: string; imovelId: string }
  onCancelar: () => void
  onRegistrar: (contato: ContatoComercial) => void
}

function RegistrarContato({ responsaveis, imoveis, inicial, onCancelar, onRegistrar }: Readonly<RegistrarContatoProps>) {
  const hoje = '10/10/10'
  const [data, setData] = useState(hoje)
  const [canal, setCanal] = useState<CanalContato>('WhatsApp')
  const [responsavel, setResponsavel] = useState(inicial.responsavel)
  const [imovelId, setImovelId] = useState(inicial.imovelId)
  const [assunto, setAssunto] = useState('')
  const [resultado, setResultado] = useState<ResultadoContato>('em_andamento')
  const [erros, setErros] = useState<{ data?: string; assunto?: string }>({})

  const registrar = () => {
    const e: typeof erros = {}
    if (!data) e.data = 'Informe a data do contato.'
    else if (data > hoje) e.data = 'A data não pode estar no futuro.'
    if (!assunto.trim()) e.assunto = 'Descreva o assunto do contato.'
    setErros(e)
    if (Object.keys(e).length) return
    onRegistrar({ id: novoId('ctt'), data, canal, responsavel, imovelId, assunto: assunto.trim(), resultado })
  }

  return (
    <Dialogo
      aberto
      largo
      titulo="Registrar contato"
      descricao="A interação entra no histórico de contatos comerciais do cliente."
      textoConfirmar="Registrar contato"
      onCancelar={onCancelar}
      onConfirmar={registrar}
    >
      <div className="grade">
        <Campo rotulo="Data" erro={erros.data} className="c-4">
          {(p) => <input {...p} type="date" className="input" max={hoje} value={data} onChange={(e) => setData(e.target.value)} />}
        </Campo>
        <Campo rotulo="Canal" className="c-4">
          {(p) => (
            <select {...p} className="input select" value={canal} onChange={(e) => setCanal(e.target.value as CanalContato)}>
              {CANAIS_CONTATO.map((c) => <option key={c}>{c}</option>)}
            </select>
          )}
        </Campo>
        <Campo rotulo="Resultado" className="c-4">
          {(p) => (
            <select {...p} className="input select" value={resultado} onChange={(e) => setResultado(e.target.value as ResultadoContato)}>
              {RESULTADOS_CONTATO.map((r) => (
                <option key={r} value={r}>
                  {RESULTADO_CONTATO[r].rotulo}
                </option>
              ))}
            </select>
          )}
        </Campo>
        <Campo rotulo="Responsável" className="c-6">
          {(p) => (
            <select {...p} className="input select" value={responsavel} onChange={(e) => setResponsavel(e.target.value)}>
              <option value="">Selecione</option>
              {responsaveis.map((r) => <option key={r}>{r}</option>)}
            </select>
          )}
        </Campo>
        <Campo rotulo="Imóvel" className="c-6">
          {(p) => (
            <select {...p} className="input select" value={imovelId} onChange={(e) => setImovelId(e.target.value)}>
              <option value="">Nenhum</option>
              {imoveis.map((i) => (
                <option key={i.id} value={i.id}>
                  {rotuloImovel(i)}
                </option>
              ))}
            </select>
          )}
        </Campo>
        <Campo rotulo="Assunto" erro={erros.assunto} className="c-12">
          {(p) => (
            <textarea
              {...p}
              className="input input--area"
              rows={3}
              placeholder="Ex.: Pediu simulação de parcelamento em 120x"
              value={assunto}
              onChange={(e) => setAssunto(e.target.value)}
            />
          )}
        </Campo>
      </div>
    </Dialogo>
  )
}
