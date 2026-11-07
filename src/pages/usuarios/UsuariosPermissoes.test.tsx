import { screen, waitFor, within } from '@testing-library/react'

import { lerDb } from '../../data/db'
import { autenticar } from '../../services/api'
import { renderizar } from '../../test/utils'

describe('Usuários e permissões', () => {
  it('lista os usuários com perfil e status e conta os ativos por perfil', () => {
    renderizar('/usuarios')
    expect(screen.getByRole('heading', { level: 1, name: 'Usuários e permissões' })).toBeInTheDocument()
    const renata = screen.getByText('Renata Foscarini').closest('tr')!
    expect(within(renata).getByText('Inativo')).toBeInTheDocument()
    const resumo = screen.getByRole('region', { name: 'Usuários por perfil' })
    const corretor = within(resumo).getByText('Corretor').closest('article')!
    // Renata está inativa e não entra na contagem.
    expect(within(corretor).getByText('2')).toBeInTheDocument()
  })

  it('libera e bloqueia permissões na matriz, sem tirar o administrador da gestão de usuários', async () => {
    const { user } = renderizar('/usuarios')
    const celula = screen.getByRole('button', { name: 'Coletor: Registrar venda' })
    expect(celula).toHaveAttribute('aria-pressed', 'false')
    await user.click(celula)
    expect(screen.getByRole('button', { name: 'Coletor: Registrar venda' })).toHaveAttribute('aria-pressed', 'true')
    expect(lerDb().permissoes?.registrar_venda).toContain('Coletor')

    expect(screen.getByRole('button', { name: 'Admin: Gerenciar usuários e permissões' })).toBeDisabled()
  })

  it('convida um usuário novo com validação', async () => {
    const { user } = renderizar('/usuarios')
    await user.click(screen.getByRole('link', { name: /Convidar usuário/ }))
    await user.click(screen.getByRole('button', { name: /Enviar convite/ }))
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
    expect(lerDb().usuarios.find((u) => u.email === 'carla@urbizzi.com.br')).toMatchObject({ papel: 'Coletor', ativo: true })
  })

  it('edita um usuário existente e desativa o acesso', async () => {
    const { user } = renderizar('/usuarios')
    await user.click(screen.getByRole('link', { name: 'Editar Matheus Oening' }))
    expect(screen.getByLabelText('Nome completo')).toHaveValue('Matheus Oening')
    await user.click(screen.getByRole('switch', { name: 'Usuário ativo' }))
    await user.click(screen.getByRole('button', { name: /Salvar alterações/ }))

    await waitFor(() => expect(lerDb().usuarios.find((u) => u.nome === 'Matheus Oening')?.ativo).toBe(false))
    await expect(autenticar('matheus@urbizzi.com.br', 'urbizzi123')).rejects.toThrow('Usuário inativo')
  })

  it('não deixa o sistema sem administrador ativo', async () => {
    const { user } = renderizar('/usuarios/usr-1')
    await user.selectOptions(screen.getByLabelText('Perfil'), 'Corretor')
    await user.click(screen.getByRole('button', { name: /Salvar alterações/ }))
    expect(await screen.findByText('O sistema precisa de pelo menos um administrador ativo.')).toBeInTheDocument()
  })
})
