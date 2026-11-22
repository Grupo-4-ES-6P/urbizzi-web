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
    expect(await screen.findByRole('alert')).toHaveTextContent('Email ou senha inválidos.')
  })

  it('mostra o motivo quando o usuário está inativo', async () => {
    const { user } = renderizar('/login', { logado: false })
    await user.type(screen.getByLabelText('E-mail'), 'renata@urbizzi.com.br')
    await user.type(screen.getByLabelText('Senha'), 'urbizzi123')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Usuário inativo')
  })

  it('avisa quando a API está fora do ar', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const { user } = renderizar('/login', { logado: false })
    await user.type(screen.getByLabelText('E-mail'), 'admin@urbizzi.com.br')
    await user.type(screen.getByLabelText('Senha'), 'urbizzi123')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível conectar ao servidor.')
  })

  it('entra e volta para a página que exigiu login', async () => {
    const { user } = renderizar('/imoveis/novo', { logado: false })
    await user.type(screen.getByLabelText('E-mail'), 'admin@urbizzi.com.br')
    await user.type(screen.getByLabelText('Senha'), 'urbizzi123')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByRole('heading', { name: 'Cadastrar imóvel' })).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('urbizzi:sessao')!)).toMatchObject({
      token: 'token-usr-1',
      usuario: { nome: 'Ayran Bade', papel: 'Administrador' },
    })
  })

  it('descarta sessão adulterada no navegador', async () => {
    sessionStorage.setItem(
      'urbizzi:sessao',
      JSON.stringify({ token: '<script>', usuario: { id: '1', nome: 'X', email: 'x@x', papel: 'Administrador' }, permissoes: [] }),
    )
    renderizar('/usuarios', { logado: false })
    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeInTheDocument()

    sessionStorage.setItem(
      'urbizzi:sessao',
      JSON.stringify({ token: 'token-ok', usuario: { id: '1', nome: 'X', email: 'x@x', papel: 'Hacker' }, permissoes: [] }),
    )
    renderizar('/usuarios', { logado: false })
    expect(await screen.findAllByRole('button', { name: 'Entrar' })).toHaveLength(2)
  })

  it('permite solicitar recuperação de senha', async () => {
    const { user } = renderizar('/login', { logado: false })
    await user.click(screen.getByRole('button', { name: 'Esqueci minha senha' }))
    await user.type(screen.getByLabelText('E-mail'), 'alguem@urbizzi.com.br')
    await user.click(screen.getByRole('button', { name: 'Enviar link de recuperação' }))
    expect(await screen.findByText('Verifique seu e-mail')).toBeInTheDocument()
  })
})
