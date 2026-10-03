import type { Cliente, EnderecoCliente, TipoPessoa } from '../data/types'

// ===== Máscaras e documentos =====

function mascaraCpf(d: string) {
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

function mascaraCnpj(d: string) {
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

export function mascaraCpfCnpj(valor: string, tipo: TipoPessoa) {
  const d = valor.replace(/\D/g, '').slice(0, tipo === 'fisica' ? 11 : 14)
  return tipo === 'fisica' ? mascaraCpf(d) : mascaraCnpj(d)
}

/** (45) 99812-4477 ou (45) 3252-1100 */
export function mascaraTelefone(valor: string) {
  const d = valor.replace(/\D/g, '').slice(0, 11)
  if (d.length === 0) return ''
  if (d.length <= 2) return `(${d}`
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

export function cpfValido(valor: string) {
  const cpf = valor.replace(/\D/g, '')
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
  const digito = (base: string) => {
    let soma = 0
    let peso = base.length + 1
    for (const n of base) soma += Number(n) * peso--
    const resto = (soma * 10) % 11
    return resto === 10 ? 0 : resto
  }
  const d1 = digito(cpf.slice(0, 9))
  const d2 = digito(cpf.slice(0, 9) + d1)
  return cpf === `${cpf.slice(0, 9)}${d1}${d2}`
}

export function cnpjValido(valor: string) {
  const cnpj = valor.replace(/\D/g, '')
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false
  const digito = (base: string, pesos: number[]) => {
    const soma = [...base].reduce((s, n, i) => s + Number(n) * pesos[i], 0)
    const resto = soma % 11
    return resto < 2 ? 0 : 11 - resto
  }
  const d1 = digito(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  const d2 = digito(cnpj.slice(0, 12) + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  return cnpj === `${cnpj.slice(0, 12)}${d1}${d2}`
}

export function documentoValido(valor: string, tipo: TipoPessoa) {
  return tipo === 'fisica' ? cpfValido(valor) : cnpjValido(valor)
}

// ===== Formulário =====

export type FormCliente = Omit<Cliente, 'id' | 'criadoEm' | 'atualizadoEm'>

type CampoEndereco = keyof EnderecoCliente
export type ErrosCliente = Partial<Record<Exclude<keyof FormCliente, 'endereco'> | `endereco.${CampoEndereco}`, string>>

export const ESTADOS_CIVIS = ['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)', 'União estável']

export function clienteVazio(): FormCliente {
  return {
    nome: '',
    tipoPessoa: 'fisica',
    cpfCnpj: '',
    dataNascimento: '',
    estadoCivil: '',
    profissao: '',
    telefone: '',
    email: '',
    ativo: true,
    endereco: { cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: 'PR', pais: 'Brasil' },
  }
}

export function formDeCliente(c: Cliente): FormCliente {
  const { id: _id, criadoEm: _c, atualizadoEm: _a, ...form } = c
  void _id
  void _c
  void _a
  return { ...form, endereco: { ...form.endereco } }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validarCliente(f: FormCliente, hoje = new Date().toISOString().slice(0, 10)): ErrosCliente {
  const e: ErrosCliente = {}
  const nome = f.nome.trim()
  if (!nome) e.nome = 'Informe o nome completo.'
  else if (nome.length < 3) e.nome = 'O nome deve ter pelo menos 3 caracteres.'

  const fisica = f.tipoPessoa === 'fisica'
  if (!f.cpfCnpj.trim()) e.cpfCnpj = fisica ? 'Informe o CPF.' : 'Informe o CNPJ.'
  else if (!documentoValido(f.cpfCnpj, f.tipoPessoa)) e.cpfCnpj = fisica ? 'Informe um CPF válido.' : 'Informe um CNPJ válido.'

  const telefone = f.telefone.trim()
  const email = f.email.trim()
  if (!telefone && !email) {
    e.telefone = 'Informe pelo menos um telefone ou e-mail.'
    e.email = 'Informe pelo menos um telefone ou e-mail.'
  } else {
    if (telefone && telefone.replace(/\D/g, '').length < 10) e.telefone = 'Telefone incompleto.'
    if (email && !EMAIL.test(email)) e.email = 'Informe um e-mail válido.'
  }

  if (f.dataNascimento && f.dataNascimento > hoje) e.dataNascimento = 'A data não pode estar no futuro.'

  const end = f.endereco
  if (!end.cep.trim()) e['endereco.cep'] = 'Informe o CEP.'
  else if (end.cep.replace(/\D/g, '').length !== 8) e['endereco.cep'] = 'CEP deve ter 8 dígitos.'
  if (!end.logradouro.trim()) e['endereco.logradouro'] = 'Informe o logradouro.'
  if (!end.bairro.trim()) e['endereco.bairro'] = 'Informe o bairro.'
  if (!end.cidade.trim()) e['endereco.cidade'] = 'Informe a cidade.'
  if (!end.uf.trim()) e['endereco.uf'] = 'Informe a UF.'
  if (!end.pais.trim()) e['endereco.pais'] = 'Informe o país.'
  return e
}
