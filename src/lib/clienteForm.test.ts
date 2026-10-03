import { clienteVazio, cnpjValido, cpfValido, mascaraCpfCnpj, mascaraTelefone, validarCliente, type FormCliente } from './clienteForm'

function valido(parcial: Partial<FormCliente> = {}): FormCliente {
  const base = clienteVazio()
  return {
    ...base,
    nome: 'Maria da Silva',
    cpfCnpj: '529.982.247-25',
    email: 'maria@email.com',
    endereco: { ...base.endereco, cep: '85900-000', logradouro: 'Rua Sarandi', bairro: 'Centro', cidade: 'Toledo' },
    ...parcial,
  }
}

describe('documentos', () => {
  it('valida CPF e CNPJ pelos dígitos verificadores', () => {
    expect(cpfValido('529.982.247-25')).toBe(true)
    expect(cpfValido('529.982.247-24')).toBe(false)
    expect(cpfValido('111.111.111-11')).toBe(false)
    expect(cnpjValido('11.222.333/0001-81')).toBe(true)
    expect(cnpjValido('11.222.333/0001-80')).toBe(false)
  })

  it('aplica as máscaras de CPF, CNPJ e telefone', () => {
    expect(mascaraCpfCnpj('52998224725', 'fisica')).toBe('529.982.247-25')
    expect(mascaraCpfCnpj('11222333000181', 'juridica')).toBe('11.222.333/0001-81')
    expect(mascaraTelefone('45998124477')).toBe('(45) 99812-4477')
    expect(mascaraTelefone('4532521100')).toBe('(45) 3252-1100')
  })
})

describe('validarCliente', () => {
  it('aceita um cadastro completo', () => {
    expect(validarCliente(valido())).toEqual({})
  })

  it('exige nome, documento e endereço', () => {
    const erros = validarCliente(clienteVazio())
    expect(erros.nome).toBe('Informe o nome completo.')
    expect(erros.cpfCnpj).toBe('Informe o CPF.')
    expect(erros['endereco.cep']).toBe('Informe o CEP.')
    expect(erros['endereco.logradouro']).toBe('Informe o logradouro.')
  })

  it('exige pelo menos um telefone ou e-mail', () => {
    const erros = validarCliente(valido({ email: '', telefone: '' }))
    expect(erros.telefone).toBe('Informe pelo menos um telefone ou e-mail.')
    expect(erros.email).toBe('Informe pelo menos um telefone ou e-mail.')
    expect(validarCliente(valido({ email: '', telefone: '(45) 99812-4477' }))).toEqual({})
  })

  it('rejeita documento inválido, e-mail malformado e nascimento no futuro', () => {
    const erros = validarCliente(valido({ cpfCnpj: '123.456.789-00', email: 'maria@', dataNascimento: '2999-01-01' }), '2026-10-03')
    expect(erros.cpfCnpj).toBe('Informe um CPF válido.')
    expect(erros.email).toBe('Informe um e-mail válido.')
    expect(erros.dataNascimento).toBe('A data não pode estar no futuro.')
  })

  it('pede CNPJ para pessoa jurídica', () => {
    expect(validarCliente(valido({ tipoPessoa: 'juridica', cpfCnpj: '' })).cpfCnpj).toBe('Informe o CNPJ.')
  })
})
