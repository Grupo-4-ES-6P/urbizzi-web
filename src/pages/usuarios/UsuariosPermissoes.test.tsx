import { screen, waitFor, within } from '@testing-library/react'

import { entrarNaApi } from '../../services/auth'
import { matrizDaApiFalsa, usuariosDaApiFalsa } from '../../test/apiFalsa'
import { renderizar } from '../../test/utils'

describe('Usuários e permissões', () => {
  it('lista os usuários com perfil e status e conta os ativos por perfil', async () => {
    renderizar('/usuarios')
    expect(await screen.findByRole('heading', { level: 1, name: 'Usuários e permissões' })).toBeInTheDocument()
    const renata = screen.getByText('Renata Foscarini').closest('tr')!
    expect(within(renata).getByText('Inativo')).toBeInTheDocument()
    const resumo = screen.getByRole('region', { name: 'Usuários por perfil' })
    const corretor = within(resumo).getByText('Corretor').closest('article')!
    // Renata está inativa e não entra na contagem.
    expect(within(corretor).getByText('2')).toBeInTheDocument()
  })

  it('mostra erro e permite tentar de novo quando a API falha', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const { user } = renderizar('/usuarios')
    expect(await screen.findByText('Não foi possível conectar ao servidor.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText('Renata Foscarini')).toBeInTheDocument()
  })

  it('libera e bloqueia permissões na matriz, sem tirar o administrador da gestão de usuários', async () => {
    const { user } = renderizar('/usuarios')
    const celula = await screen.findByRole('button', { name: 'Coletor: Registrar venda' })
    expect(celula).toHaveAttribute('aria-pressed', 'false')
    await user.click(celula)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Coletor: Registrar venda' })).toHaveAttribute('aria-pressed', 'true'),
    )
    expect(matrizDaApiFalsa().REGISTRAR_VENDA).toContain('COLETOR')

    expect(screen.getByRole('button', { name: 'Admin: Gerenciar usuários e permissões' })).toBeDisabled()
  })

  it('convida um usuário novo com validação', async () => {
    const { user } = renderizar('/usuarios')
    await user.click(await screen.findByRole('link', { name: /Convidar usuário/ }))
    await user.click(await screen.findByRole('button', { name: /Enviar convite/ }))
    expect(screen.getByText('Informe nome e sobrenome.')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Nome completo'), 'Carla Mendes')
    await user.type(screen.getByLabelText('E-mail'), 'arthur@urbizzi.com.br')
    await user.type(screen.getByLabelText('Senha provisória'), 'segura123')
    await user.click(screen.getByRole('button', { name: /Enviar convite/ }))
    expect(screen.getByText('Já existe um usuário com este e-mail.')).toBeInTheDocument()

    await user.clear(screen.getByLabelText('E-mail'))
    await user.type(screen.getByLabelText('E-mail'), 'carla@urbizzi.com.br')
    await user.selectOptions(screen.getByLabelText('Perfil'), 'Coletor')
    await user.click(screen.getByRole('button', { name: /Enviar convite/ }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Usuários e permissões' })).toBeInTheDocument()
    expect(usuariosDaApiFalsa().find((u) => u.email === 'carla@urbizzi.com.br')).toMatchObject({
      name: 'Carla Mendes',
      perfil: 'COLETOR',
      status: 'ATIVO',
    })
  })

  it('edita um usuário existente e desativa o acesso', async () => {
    const { user } = renderizar('/usuarios')
    await user.click(await screen.findByRole('link', { name: 'Editar Matheus Oening' }))
    expect(await screen.findByLabelText('Nome completo')).toHaveValue('Matheus Oening')
    await user.click(screen.getByRole('switch', { name: 'Usuário ativo' }))
    await user.click(screen.getByRole('button', { name: /Salvar alterações/ }))

    await waitFor(() => expect(usuariosDaApiFalsa().find((u) => u.name === 'Matheus Oening')?.status).toBe('INATIVO'))
    await expect(entrarNaApi('matheus@urbizzi.com.br', 'urbizzi123')).rejects.toThrow('Usuário inativo')
  })

  it('não deixa o sistema sem administrador ativo', async () => {
    const { user } = renderizar('/usuarios/usr-1')
    await user.selectOptions(await screen.findByLabelText('Perfil'), 'Corretor')
    await user.click(screen.getByRole('button', { name: /Salvar alterações/ }))
    expect(await screen.findByText('O sistema precisa de pelo menos um administrador ativo.')).toBeInTheDocument()
  })
})
