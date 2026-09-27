import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ClienteForm } from './ClienteForm'

function renderClienteForm(onSubmit = vi.fn(), onCancel = vi.fn()) {
  render(<ClienteForm formId="cliente-form" onSubmit={onSubmit} onCancel={onCancel} />)
  return { onSubmit, onCancel }
}

async function preencherEnderecoObrigatorio(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/cpf/i), '52998224725')
  await user.type(screen.getByLabelText(/cep/i), '01310100')
  await user.type(screen.getByLabelText(/^rua$/i), 'Av. Paulista')
  await user.type(screen.getByLabelText(/bairro/i), 'Bela Vista')
  await user.type(screen.getByLabelText(/cidade/i), 'São Paulo')
  await user.type(screen.getByLabelText(/^uf$/i), 'SP')
  await user.type(screen.getByLabelText(/país/i), 'Brasil')
}

describe('ClienteForm', () => {
  it('renderiza todos os campos do formulário', () => {
    renderClienteForm()

    expect(screen.getByLabelText(/nome completo/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/telefone/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/cpf/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/cep/i)).toBeInTheDocument()
  })

  it('bloqueia envio sem nome_completo', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderClienteForm()

    await user.type(screen.getByLabelText(/telefone/i), '11912345678')
    await user.click(screen.getByRole('button', { name: /salvar cliente/i }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(await screen.findByText(/informe o nome completo/i)).toBeInTheDocument()
  })

  it('bloqueia envio sem telefone e sem email preenchidos', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderClienteForm()

    await user.type(screen.getByLabelText(/nome completo/i), 'Maria da Silva')
    await user.click(screen.getByRole('button', { name: /salvar cliente/i }))

    expect(onSubmit).not.toHaveBeenCalled()
    const mensagens = await screen.findAllByText(/pelo menos um telefone ou e-mail/i)
    expect(mensagens.length).toBeGreaterThan(0)
  })

  it('bloqueia envio sem endereço preenchido', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderClienteForm()

    await user.type(screen.getByLabelText(/nome completo/i), 'Maria da Silva')
    await user.type(screen.getByLabelText(/telefone/i), '11912345678')
    await user.type(screen.getByLabelText(/cpf/i), '52998224725')
    await user.click(screen.getByRole('button', { name: /salvar cliente/i }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(await screen.findByText(/informe o cep/i)).toBeInTheDocument()
  })

  it('valida o CPF quando a pessoa é física', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderClienteForm()

    await user.type(screen.getByLabelText(/nome completo/i), 'Maria da Silva')
    await user.type(screen.getByLabelText(/telefone/i), '11912345678')
    await user.type(screen.getByLabelText(/cpf/i), '11111111111')
    await user.click(screen.getByRole('button', { name: /salvar cliente/i }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(await screen.findByText(/informe um cpf válido/i)).toBeInTheDocument()
  })

  it('exige CNPJ quando o tipo de pessoa é jurídica', async () => {
    const user = userEvent.setup()
    renderClienteForm()

    await user.selectOptions(screen.getByLabelText(/tipo de pessoa/i), 'juridica')

    expect(screen.getByLabelText(/^cnpj$/i)).toBeInTheDocument()

    await user.type(screen.getByLabelText(/^cnpj$/i), '11222333000181')
    await user.click(screen.getByRole('button', { name: /salvar cliente/i }))

    expect(screen.queryByText(/informe um cnpj válido/i)).not.toBeInTheDocument()
  })

  it('aceita envio com nome_completo + telefone (sem email) e demais campos obrigatórios', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderClienteForm()

    await user.type(screen.getByLabelText(/nome completo/i), 'Maria da Silva')
    await user.type(screen.getByLabelText(/telefone/i), '11912345678')
    await preencherEnderecoObrigatorio(user)
    await user.click(screen.getByRole('button', { name: /salvar cliente/i }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ nome_completo: 'Maria da Silva', email: '' }),
    )
  })

  it('aceita envio com nome_completo + email (sem telefone) e demais campos obrigatórios', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderClienteForm()

    await user.type(screen.getByLabelText(/nome completo/i), 'Maria da Silva')
    await user.type(screen.getByLabelText(/e-mail/i), 'maria@email.com')
    await preencherEnderecoObrigatorio(user)
    await user.click(screen.getByRole('button', { name: /salvar cliente/i }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ nome_completo: 'Maria da Silva', telefone: '' }),
    )
  })

  it('valida formato de e-mail inválido', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderClienteForm()

    await user.type(screen.getByLabelText(/nome completo/i), 'Maria da Silva')
    await user.type(screen.getByLabelText(/e-mail/i), 'email-invalido')
    await user.click(screen.getByRole('button', { name: /salvar cliente/i }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(await screen.findByText(/informe um e-mail válido/i)).toBeInTheDocument()
  })

  it('chama onCancel ao clicar em Cancelar', async () => {
    const user = userEvent.setup()
    const { onCancel } = renderClienteForm()

    await user.click(screen.getByRole('button', { name: /cancelar/i }))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('pede confirmação antes de limpar os campos e limpa ao confirmar', async () => {
    const user = userEvent.setup()
    renderClienteForm()

    await user.type(screen.getByLabelText(/nome completo/i), 'Maria da Silva')
    await user.click(screen.getByRole('button', { name: /limpar/i }))

    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText(/tem certeza que quer limpar todos os campos/i)).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: /limpar/i }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/nome completo/i)).toHaveValue('')
  })

  it('mantém os campos preenchidos ao cancelar a confirmação de limpeza', async () => {
    const user = userEvent.setup()
    renderClienteForm()

    await user.type(screen.getByLabelText(/nome completo/i), 'Maria da Silva')
    await user.click(screen.getByRole('button', { name: /limpar/i }))

    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: /cancelar/i }))

    expect(screen.getByLabelText(/nome completo/i)).toHaveValue('Maria da Silva')
  })
})
