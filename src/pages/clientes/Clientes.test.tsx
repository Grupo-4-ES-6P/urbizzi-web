import { reservasDe } from '../../data/selectors'
import { screen, waitFor, within } from '@testing-library/react'

import { lerDb } from '../../data/db'
import { clientesDaApiFalsa, fetchFalso } from '../../test/apiFalsa'
import { renderizar } from '../../test/utils'

const linhas = () => within(screen.getByRole('table')).getAllByRole('row').slice(1)

describe('Lista de clientes', () => {
  it('busca por nome ignorando acentos e por dígitos do CPF', async () => {
    const { user } = renderizar('/clientes')
    expect(
      await screen.findByText(/^32 cadastrados · \d+ com reserva ativa · \d+ com proposta em análise$/),
    ).toBeInTheDocument()

    const busca = screen.getByRole('searchbox', { name: 'Buscar clientes' })
    await user.type(busca, 'silvia')
    expect(linhas()).toHaveLength(1)
    expect(linhas()[0]).toHaveTextContent('Sílvia Menegatti')
    expect(linhas()[0]).toHaveTextContent('Inativo')

    const cpf = lerDb().clientes[0].cpfCnpj
    await user.clear(busca)
    await user.type(busca, cpf.replace(/\D/g, ''))
    expect(linhas()[0]).toHaveTextContent('Marina Alves')
  })

  it('desativa os clientes selecionados', async () => {
    const { user } = renderizar('/clientes')
    await user.click(await screen.findByRole('checkbox', { name: 'Selecionar Marina Alves' }))
    await user.click(screen.getByRole('button', { name: 'Desativar' }))

    expect(await screen.findByText('Clientes desativados.')).toBeInTheDocument()
    expect(clientesDaApiFalsa().find((c) => c.nome === 'Marina Alves')?.status).toBe('INATIVO')
  })

  it('exclui os clientes selecionados', async () => {
    const { user } = renderizar('/clientes')
    await user.click(await screen.findByRole('checkbox', { name: 'Selecionar Aline Becker' }))
    await user.click(screen.getByRole('button', { name: 'Excluir' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluir' }))

    expect(await screen.findByText('1 cliente excluído.')).toBeInTheDocument()
    expect(clientesDaApiFalsa().some((c) => c.nome === 'Aline Becker')).toBe(false)
    await waitFor(() => expect(screen.queryByText('Aline Becker')).not.toBeInTheDocument())
  })

  it('mostra erro e permite tentar de novo quando a API falha', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const { user } = renderizar('/clientes')
    expect(await screen.findByText('Não foi possível conectar ao servidor.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText('Marina Alves')).toBeInTheDocument()
  })
})

describe('Cadastro de cliente', () => {
  it('não salva com campos obrigatórios vazios', async () => {
    const { user } = renderizar('/clientes/novo')
    await user.click(await screen.findByRole('button', { name: 'Salvar cliente' }))

    expect(screen.getByText('Informe o nome completo.')).toBeInTheDocument()
    expect(screen.getByText('Informe o CPF.')).toBeInTheDocument()
    expect(screen.getAllByText('Informe pelo menos um telefone ou e-mail.')).toHaveLength(3)
    expect(screen.getByLabelText('Nome completo / Razão social')).toHaveAttribute('aria-invalid', 'true')
    expect(clientesDaApiFalsa()).toHaveLength(32)
  })

  it('preenche o endereço pelo CEP e cadastra o cliente', async () => {
    vi.mocked(fetch).mockImplementation(async (entrada, init) =>
      String(entrada).includes('viacep.com.br')
        ? Response.json({ logradouro: 'Rua Barão do Rio Branco', bairro: 'Centro', localidade: 'Toledo', uf: 'PR' })
        : fetchFalso(entrada, init),
    )
    const { user } = renderizar('/clientes/novo')

    await user.type(await screen.findByLabelText('Nome completo / Razão social'), 'Maria da Silva')
    await user.type(screen.getByLabelText('CPF / CNPJ'), '52998224725')
    expect(screen.getByLabelText('CPF / CNPJ')).toHaveValue('529.982.247-25')
    await user.type(screen.getByLabelText('Telefone'), '45998124477')
    await user.selectOptions(screen.getByLabelText('Origem do cadastro'), 'Catálogo público')
    await user.selectOptions(screen.getByLabelText('Responsável comercial'), 'Gustavo Marques')
    await user.type(screen.getByLabelText('CEP'), '85900010')
    await waitFor(() => expect(screen.getByLabelText('Logradouro')).toHaveValue('Rua Barão do Rio Branco'))
    await user.type(screen.getByLabelText('Número'), '1200')
    await user.click(screen.getByRole('button', { name: 'Salvar cliente' }))

    expect(await screen.findByRole('heading', { name: 'Clientes' })).toBeInTheDocument()
    expect(clientesDaApiFalsa().at(-1)).toMatchObject({
      tipoDocumento: 'CPF',
      nome: 'Maria da Silva',
      documentoIdentificacao: '52998224725',
      telefone: '45998124477',
      status: 'ATIVO',
      origem: 'Catálogo público',
      responsavel: 'Gustavo Marques',
      endereco: { cep: '85900010', logradouro: 'Rua Barão do Rio Branco', numero: '1200', cidade: 'Toledo', uf: 'PR' },
    })
  })

  it('mostra o erro da API quando o CPF já está cadastrado', async () => {
    vi.mocked(fetch).mockImplementation(async (entrada, init) =>
      String(entrada).includes('viacep.com.br')
        ? Response.json({ logradouro: 'Rua A', bairro: 'Centro', localidade: 'Toledo', uf: 'PR' })
        : fetchFalso(entrada, init),
    )
    const { user } = renderizar('/clientes/novo')
    const cpf = lerDb().clientes[0].cpfCnpj

    await user.type(await screen.findByLabelText('Nome completo / Razão social'), 'Outra Pessoa')
    await user.type(screen.getByLabelText('CPF / CNPJ'), cpf.replace(/\D/g, ''))
    await user.type(screen.getByLabelText('Telefone'), '45998124477')
    await user.type(screen.getByLabelText('CEP'), '85900010')
    await waitFor(() => expect(screen.getByLabelText('Logradouro')).toHaveValue('Rua A'))
    await user.click(screen.getByRole('button', { name: 'Salvar cliente' }))

    expect(await screen.findByText('Já existe cliente com este CPF ou CNPJ.')).toBeInTheDocument()
    expect(clientesDaApiFalsa()).toHaveLength(32)
  })

  it('edita o cliente e mostra as reservas dele', async () => {
    const reserva = reservasDe(lerDb()).find((r) => r.clienteId === 'cli-1')!
    const { user } = renderizar('/clientes/cli-1')

    expect(await screen.findByRole('heading', { name: 'Editar cliente' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: reserva.codigo })).toBeInTheDocument()

    const email = screen.getByLabelText('E-mail')
    await user.clear(email)
    await user.type(email, 'marina@urbizzi.com.br')
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    expect(await screen.findByText('Cliente atualizado.')).toBeInTheDocument()
    expect(clientesDaApiFalsa()[0].email).toBe('marina@urbizzi.com.br')
  })

  it('avisa quando o cliente não existe', async () => {
    renderizar('/clientes/cli-inexistente')
    expect(await screen.findByRole('heading', { name: 'Cliente não encontrado' })).toBeInTheDocument()
  })

  it('registra um contato comercial e grava junto com o cliente', async () => {
    const antes = clientesDaApiFalsa()[0].contatos.length
    const { user } = renderizar('/clientes/cli-1')

    await user.click(await screen.findByRole('button', { name: 'Registrar contato' }))
    const dialogo = screen.getByRole('dialog')
    await user.click(within(dialogo).getByRole('button', { name: 'Registrar contato' }))
    expect(within(dialogo).getByText('Descreva o assunto do contato.')).toBeInTheDocument()

    await user.selectOptions(within(dialogo).getByLabelText('Canal'), 'Telefone')
    await user.selectOptions(within(dialogo).getByLabelText('Resultado'), 'positivo')
    await user.type(within(dialogo).getByLabelText('Assunto'), 'Retorno sobre a simulação')
    await user.click(within(dialogo).getByRole('button', { name: 'Registrar contato' }))

    const tabela = screen.getByRole('table', { name: 'Contatos comerciais' })
    expect(within(tabela).getAllByRole('row')[1]).toHaveTextContent(/Telefone.*Ayran Bade.*Retorno sobre a simulação.*Positivo/)

    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(await screen.findByText('Cliente atualizado.')).toBeInTheDocument()
    const contatos = clientesDaApiFalsa()[0].contatos
    expect(contatos).toHaveLength(antes + 1)
    expect(contatos).toContainEqual(
      expect.objectContaining({ canal: 'Telefone', responsavel: 'Ayran Bade', assunto: 'Retorno sobre a simulação', resultado: 'positivo' }),
    )
  })
})
