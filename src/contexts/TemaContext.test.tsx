import { screen } from '@testing-library/react'

import { renderizar } from '../test/utils'

const temaAplicado = () => document.documentElement.getAttribute('data-theme')

describe('Tema', () => {
  it('começa claro sem preferência salva e alterna pelo menu da conta', async () => {
    const { user } = renderizar('/dashboard')
    expect(temaAplicado()).toBe('light')

    await user.click(screen.getByRole('button', { name: /Ayran Bade/ }))
    await user.click(screen.getByRole('menuitem', { name: 'Tema escuro' }))

    expect(temaAplicado()).toBe('dark')
    expect(localStorage.getItem('urbizzi:tema')).toBe('escuro')
  })

  it('respeita a escolha salva e permite voltar ao claro no login', async () => {
    localStorage.setItem('urbizzi:tema', 'escuro')
    const { user } = renderizar('/login', { logado: false })
    expect(temaAplicado()).toBe('dark')

    await user.click(screen.getByRole('button', { name: 'Usar tema claro' }))
    expect(temaAplicado()).toBe('light')
    expect(localStorage.getItem('urbizzi:tema')).toBe('claro')
  })

  it('o site público também tem o botão de tema', () => {
    renderizar('/terrenos', { logado: false })
    expect(screen.getByRole('button', { name: 'Usar tema escuro' })).toBeInTheDocument()
  })
})

describe('Tema no dashboard', () => {
  it('tem o botão de tema no cabeçalho', async () => {
    const { user } = renderizar('/dashboard')
    const acoes = screen.getByRole('button', { name: 'Usar tema escuro' }).closest('.cabecalho__acoes')
    expect(acoes).not.toBeNull()

    await user.click(screen.getByRole('button', { name: 'Usar tema escuro' }))
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(screen.getByRole('button', { name: 'Usar tema claro' })).toBeInTheDocument()
  })
})
