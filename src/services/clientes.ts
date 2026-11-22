import type { CanalContato, Cliente, ContatoComercial, ResultadoContato } from '../data/types'
import type { FormCliente } from '../lib/clienteForm'
import { mascaraCpfCnpj, mascaraTelefone } from '../lib/clienteForm'
import { mascaraCep } from '../lib/format'
import { http } from './http'

interface ContatoApi {
  id?: string
  data: string
  canal: string
  responsavel: string
  imovelId: string | null
  assunto: string
  resultado: string
}

interface ClienteApi {
  id: string
  tipoDocumento: 'CPF' | 'CNPJ'
  documentoIdentificacao: string
  nome: string | null
  razaoSocial: string | null
  telefone: string | null
  celular: string | null
  email: string | null
  origem: string | null
  rg: string | null
  dataNascimento: string | null
  estadoCivil: string | null
  profissao: string | null
  responsavel: string | null
  imovelInteresseId: string | null
  endereco: Record<'cep' | 'logradouro' | 'numero' | 'complemento' | 'bairro' | 'cidade' | 'uf' | 'pais', string | null>
  contatos: ContatoApi[]
  status: 'ATIVO' | 'INATIVO'
  dataCadastro: string
  dataAtualizacao: string
}

interface PaginaApi {
  data: ClienteApi[]
  page: { page: number; totalPages: number }
}

const POR_PAGINA_API = 100

function paraCliente(c: ClienteApi): Cliente {
  const tipoPessoa = c.tipoDocumento === 'CPF' ? 'fisica' : 'juridica'
  const e = c.endereco
  return {
    id: c.id,
    nome: (tipoPessoa === 'fisica' ? c.nome : c.razaoSocial) ?? '',
    tipoPessoa,
    cpfCnpj: mascaraCpfCnpj(c.documentoIdentificacao, tipoPessoa),
    rg: c.rg ?? '',
    dataNascimento: c.dataNascimento ?? '',
    estadoCivil: c.estadoCivil ?? '',
    profissao: c.profissao ?? '',
    telefone: mascaraTelefone(c.telefone ?? ''),
    celular: mascaraTelefone(c.celular ?? ''),
    email: c.email ?? '',
    ativo: c.status === 'ATIVO',
    endereco: {
      cep: mascaraCep(e.cep ?? ''),
      logradouro: e.logradouro ?? '',
      numero: e.numero ?? '',
      complemento: e.complemento ?? '',
      bairro: e.bairro ?? '',
      cidade: e.cidade ?? '',
      uf: e.uf ?? '',
      pais: e.pais ?? '',
    },
    origem: c.origem ?? '',
    responsavel: c.responsavel ?? '',
    imovelInteresseId: c.imovelInteresseId ?? '',
    contatos: c.contatos.map(
      (ct, i): ContatoComercial => ({
        id: ct.id ?? `ctt-${c.id}-${i}`,
        data: ct.data,
        canal: ct.canal as CanalContato,
        responsavel: ct.responsavel,
        imovelId: ct.imovelId ?? '',
        assunto: ct.assunto,
        resultado: ct.resultado as ResultadoContato,
      }),
    ),
    criadoEm: c.dataCadastro,
    atualizadoEm: c.dataAtualizacao,
  }
}

function paraApi(form: FormCliente) {
  const fisica = form.tipoPessoa === 'fisica'
  return {
    tipoDocumento: fisica ? 'CPF' : 'CNPJ',
    documentoIdentificacao: form.cpfCnpj,
    nome: fisica ? form.nome.trim() : null,
    razaoSocial: fisica ? null : form.nome.trim(),
    telefone: form.telefone,
    celular: form.celular,
    email: form.email.trim(),
    origem: form.origem,
    rg: form.rg,
    dataNascimento: form.dataNascimento,
    estadoCivil: fisica ? form.estadoCivil : '',
    profissao: fisica ? form.profissao : '',
    responsavel: form.responsavel,
    imovelInteresseId: form.imovelInteresseId,
    endereco: form.endereco,
    contatos: form.contatos.map(({ data, canal, responsavel, imovelId, assunto, resultado }) => ({
      data,
      canal,
      responsavel,
      imovelId,
      assunto,
      resultado,
    })),
  }
}

/** A API pagina em até 100 por vez; a tela filtra e pagina localmente. */
export async function listarClientes(signal?: AbortSignal) {
  const clientes: Cliente[] = []
  for (let pagina = 1; ; pagina++) {
    const resposta = await http<PaginaApi>(`/clientes?page=${pagina}&perPage=${POR_PAGINA_API}`, { signal })
    clientes.push(...resposta.data.map(paraCliente))
    if (pagina >= resposta.page.totalPages) return clientes
  }
}

export async function buscarCliente(id: string, signal?: AbortSignal) {
  return paraCliente(await http<ClienteApi>(`/clientes/${id}`, { signal }))
}

export async function salvarCliente(form: FormCliente, id?: string) {
  if (id) return paraCliente(await http<ClienteApi>(`/clientes/${id}`, { method: 'PATCH', body: paraApi(form) }))
  const { cliente } = await http<{ cliente: ClienteApi }>('/clientes', { method: 'POST', body: paraApi(form) })
  return paraCliente(cliente)
}

export async function alterarStatusClientes(ids: string[], ativo: boolean) {
  await Promise.all(ids.map((id) => http(`/clientes/${id}/${ativo ? 'reativar' : 'desativar'}`, { method: 'PATCH' })))
}

// TODO: barrar na API cliente com reserva/proposta/venda (RF32)
export async function excluirClientes(ids: string[]) {
  await Promise.all(ids.map((id) => http(`/clientes/${id}`, { method: 'DELETE' })))
}
