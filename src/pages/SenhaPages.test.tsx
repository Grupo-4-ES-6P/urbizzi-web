import { screen, waitFor } from '@testing-library/react'

import { emailsDaApiFalsa, usuariosDaApiFalsa } from '../test/apiFalsa'
import { renderizar } from '../test/utils'

const admin = () => usuariosDaApiFalsa().find((u) => u.email === 'admin@urbizzi.com.br')!

describe('Senha', () => {
  it('obriga a trocar a senha provisória antes de usar o sistema', async () => {
    admin().trocarSenha = true
    const { user } = renderizar('/imoveis', { logado: false })
    await user.type(screen.getByLabelText('E-mail'), 'admin@urbizzi.com.br')
    await user.type(screen.getByLabelText('Senha'), 'urbizzi123')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('heading', { name: 'Crie sua senha' })).toBeInTheDocument()
    await user.type(screen.getByLabelText('Senha atual'), 'urbizzi123')
    await user.type(screen.getByLabelText('Nova senha'), 'nova-senha-1')
    await user.type(screen.getByLabelText('Confirme a nova senha'), 'outra-coisa')
    await user.click(screen.getByRole('button', { name: 'Salvar nova senha' }))
    expect(screen.getByText('As senhas não conferem.')).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Confirme a nova senha'))
    await user.type(screen.getByLabelText('Confirme a nova senha'), 'nova-senha-1')
    await user.click(screen.getByRole('button', { name: 'Salvar nova senha' }))

    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Crie sua senha' })).not.toBeInTheDocument())
    expect(admin()).toMatchObject({ password: 'nova-senha-1', trocarSenha: false })
    expect(JSON.parse(localStorage.getItem('urbizzi:sessao')!).trocarSenha).toBe(false)
  })

  it('avisa quando a senha atual está errada', async () => {
    admin().trocarSenha = true
    const { user } = renderizar('/login', { logado: false })
    await user.type(screen.getByLabelText('E-mail'), 'admin@urbizzi.com.br')
    await user.type(screen.getByLabelText('Senha'), 'urbizzi123')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    await user.type(await screen.findByLabelText('Senha atual'), 'errada')
    await user.type(screen.getByLabelText('Nova senha'), 'nova-senha-1')
    await user.type(screen.getByLabelText('Confirme a nova senha'), 'nova-senha-1')
    await user.click(screen.getByRole('button', { name: 'Salvar nova senha' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Senha atual incorreta.')
  })

  it('recupera a senha pelo link do e-mail, que só vale uma vez', async () => {
    const primeira = renderizar('/login', { logado: false })
    await primeira.user.click(screen.getByRole('button', { name: 'Esqueci minha senha' }))
    await primeira.user.type(screen.getByLabelText('E-mail'), 'admin@urbizzi.com.br')
    await primeira.user.click(screen.getByRole('button', { name: 'Enviar link de recuperação' }))
    expect(await screen.findByRole('heading', { name: 'Verifique seu e-mail' })).toBeInTheDocument()
    const { token } = emailsDaApiFalsa.at(-1)!
    primeira.unmount()

    const segunda = renderizar(`/redefinir-senha?token=${token}`, { logado: false })
    await segunda.user.type(screen.getByLabelText('Nova senha'), 'recuperada-1')
    await segunda.user.type(screen.getByLabelText('Confirme a nova senha'), 'recuperada-1')
    await segunda.user.click(screen.getByRole('button', { name: 'Redefinir senha' }))
    expect(await screen.findByRole('heading', { name: 'Senha redefinida' })).toBeInTheDocument()
    expect(admin().password).toBe('recuperada-1')
    segunda.unmount()

    const terceira = renderizar(`/redefinir-senha?token=${token}`, { logado: false })
    await terceira.user.type(screen.getByLabelText('Nova senha'), 'de-novo-123')
    await terceira.user.type(screen.getByLabelText('Confirme a nova senha'), 'de-novo-123')
    await terceira.user.click(screen.getByRole('button', { name: 'Redefinir senha' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Link inválido ou expirado')
  })

  it('link sem token já avisa que é inválido', () => {
    renderizar('/redefinir-senha', { logado: false })
    expect(screen.getByRole('alert')).toHaveTextContent('Link inválido')
    expect(screen.getByRole('button', { name: 'Redefinir senha' })).toBeDisabled()
  })
})
