import { describe, it, expect, beforeEach } from 'vitest'
import { atualizarStatusClientes, criarCliente, excluirClientes, listarClientes } from './clientes'
import type { NovoClienteInput } from '../../types/Cliente'

function buildInput(overrides: Partial<NovoClienteInput> = {}): NovoClienteInput {
  return {
    nome_completo: 'Maria da Silva',
    telefone: '',
    email: 'maria@email.com',
    ativo: true,
    tipo_pessoa: 'fisica',
    cpf_cnpj: '529.982.247-25',
    data_nascimento: '',
    estado_civil: '',
    profissao: '',
    endereco: {
      cep: '01310-100',
      rua: 'Av. Paulista',
      numero: '',
      bairro: 'Bela Vista',
      cidade: 'São Paulo',
      uf: 'SP',
      pais: 'Brasil',
      complemento: '',
    },
    ...overrides,
  }
}

describe('api/clientes', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('persiste o cliente criado em localStorage', async () => {
    const cliente = await criarCliente(buildInput({ nome_completo: 'Maria da Silva' }))

    expect(cliente.id_cliente).toBe(1)
    expect(cliente.ativo).toBe(true)

    const clientes = await listarClientes()
    expect(clientes).toHaveLength(1)
    expect(clientes[0]).toMatchObject({ nome_completo: 'Maria da Silva' })
  })

  it('incrementa o id a cada novo cliente e lista em ordem alfabética', async () => {
    await criarCliente(buildInput({ nome_completo: 'Zeca Souza', email: 'zeca@email.com' }))
    const segundo = await criarCliente(buildInput({ nome_completo: 'Ana Lima', email: 'ana@email.com' }))

    expect(segundo.id_cliente).toBe(2)

    const clientes = await listarClientes()
    expect(clientes.map((c) => c.nome_completo)).toEqual(['Ana Lima', 'Zeca Souza'])
  })

  it('mantém os clientes entre chamadas, simulando persistência entre reloads', async () => {
    await criarCliente(buildInput())

    const clientes = await listarClientes()
    expect(clientes).toHaveLength(1)
  })

  it('exclui os clientes selecionados', async () => {
    const um = await criarCliente(buildInput({ nome_completo: 'Ana Lima', email: 'ana@email.com' }))
    await criarCliente(buildInput({ nome_completo: 'Zeca Souza', email: 'zeca@email.com' }))

    await excluirClientes([um.id_cliente])

    const clientes = await listarClientes()
    expect(clientes.map((c) => c.nome_completo)).toEqual(['Zeca Souza'])
  })

  it('ativa e desativa os clientes selecionados em lote', async () => {
    const um = await criarCliente(buildInput({ nome_completo: 'Ana Lima', email: 'ana@email.com' }))
    const dois = await criarCliente(buildInput({ nome_completo: 'Zeca Souza', email: 'zeca@email.com' }))

    await atualizarStatusClientes([um.id_cliente, dois.id_cliente], false)

    const clientes = await listarClientes()
    expect(clientes.every((c) => c.ativo === false)).toBe(true)
  })

  it('persiste os dados de documento e endereço do cliente', async () => {
    const cliente = await criarCliente(
      buildInput({
        tipo_pessoa: 'juridica',
        cpf_cnpj: '11.222.333/0001-81',
        endereco: {
          cep: '01310-100',
          rua: 'Av. Paulista',
          numero: '1000',
          bairro: 'Bela Vista',
          cidade: 'São Paulo',
          uf: 'sp',
          pais: 'Brasil',
          complemento: 'Sala 2',
        },
      }),
    )

    expect(cliente.tipo_pessoa).toBe('juridica')
    expect(cliente.cpf_cnpj).toBe('11.222.333/0001-81')
    expect(cliente.endereco).toMatchObject({ cidade: 'São Paulo', uf: 'SP', numero: '1000' })
  })

  it('preenche valores padrão ao ler clientes salvos antes desses novos campos existirem', async () => {
    localStorage.setItem(
      'urbizzi:clientes',
      JSON.stringify([
        {
          id_cliente: 1,
          nome_completo: 'Cliente Antigo',
          telefone: '',
          email: 'antigo@email.com',
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z',
        },
      ]),
    )

    const clientes = await listarClientes()
    expect(clientes[0]).toMatchObject({
      ativo: true,
      tipo_pessoa: 'fisica',
      cpf_cnpj: '',
      endereco: { cep: '', rua: '', pais: '' },
    })
  })
})
