import { screen, within } from '@testing-library/react'

import { lerDb } from '../data/db'
import { renderizar } from '../test/utils'

const CORRETOR = 'usr-4'
const GERENTE = 'usr-2'

describe('Telas respeitam as permissões do perfil', () => {
  it('corretor não vê usuários e relatórios no menu', async () => {
    renderizar('/dashboard', { usuarioId: CORRETOR })
    const menu = await screen.findByRole('navigation', { name: /menu/i }).catch(() => screen.getByRole('complementary'))
    expect(within(menu).queryByRole('link', { name: /Usuários/ })).not.toBeInTheDocument()
    expect(within(menu).queryByRole('link', { name: /Relatórios/ })).not.toBeInTheDocument()
    expect(within(menu).getByRole('link', { name: /Propostas/ })).toBeInTheDocument()
  })

  it('corretor que abre /usuarios pelo endereço vê "Sem permissão"', async () => {
    renderizar('/usuarios', { usuarioId: CORRETOR })
    expect(await screen.findByRole('heading', { name: 'Sem permissão' })).toBeInTheDocument()
  })

  it('corretor não vê novo imóvel nem importar, mas vê a lista', async () => {
    renderizar('/imoveis', { usuarioId: CORRETOR })
    expect(await screen.findByRole('heading', { level: 1, name: /Imóveis/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Novo imóvel/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Importar planilha/ })).not.toBeInTheDocument()
  })

  it('corretor faz contraproposta, mas não aprova nem recusa', async () => {
    const proposta = lerDb().propostas.find((p) => p.status === 'pendente')!
    renderizar(`/propostas/${proposta.id}`, { usuarioId: CORRETOR })
    expect(await screen.findByRole('button', { name: 'Contraproposta' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aprovar proposta' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Recusar proposta' })).not.toBeInTheDocument()
  })

  it('gerente aprova proposta e cadastra imóvel', async () => {
    const proposta = lerDb().propostas.find((p) => p.status === 'pendente')!
    renderizar(`/propostas/${proposta.id}`, { usuarioId: GERENTE })
    expect(await screen.findByRole('button', { name: 'Aprovar proposta' })).toBeInTheDocument()

    renderizar('/imoveis', { usuarioId: GERENTE })
    expect((await screen.findAllByRole('link', { name: /Novo imóvel/ })).length).toBeGreaterThan(0)
  })
})
