import { screen } from '@testing-library/react'

import { renderizar } from '../test/utils'

describe('Login', () => {
  it('valida campos vazios', async () => {
    const { user } = renderizar('/login', { logado: false })
    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(screen.getByText('Informe seu e-mail.')).toBeInTheDocument()
    expect(screen.getByText('Informe sua senha.')).toBeInTheDocument()
  })

  it('mostra erro com credenciais inválidas', async () => {
    const { user } = renderizar('/login', { logado: false })
    await user.type(screen.getByLabelText('E-mail'), 'admin@urbizzi.com.br')
    await user.type(screen.getByLabelText('Senha'), 'errada')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos.')
  })

  it('entra e volta para a página que exigiu login', async () => {
    const { user } = renderizar('/imoveis/novo', { logado: false })
    await user.type(screen.getByLabelText('E-mail'), 'admin@urbizzi.com.br')
    await user.type(screen.getByLabelText('Senha'), 'urbizzi123')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByRole('heading', { name: 'Cadastrar imóvel' })).toBeInTheDocument()
  })

  it('permite solicitar recuperação de senha', async () => {
    const { user } = renderizar('/login', { logado: false })
    await user.click(screen.getByRole('button', { name: 'Esqueci minha senha' }))
    await user.type(screen.getByLabelText('E-mail'), 'alguem@urbizzi.com.br')
    await user.click(screen.getByRole('button', { name: 'Enviar link de recuperação' }))
    expect(await screen.findByText('Verifique seu e-mail')).toBeInTheDocument()
  })
})
