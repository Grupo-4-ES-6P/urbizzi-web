import { screen, waitFor } from '@testing-library/react'

import { lerDb } from '../data/db'
import { linksDaApiFalsa } from '../test/apiFalsa'
import { renderizar } from '../test/utils'

describe('Link público', () => {
  it('gera o link do imóvel na tela Imóveis e o link conta a visita', async () => {
    const { user, unmount } = renderizar('/imoveis')
    const imovel = lerDb().imoveis[0]
    expect(screen.getByLabelText('Endereço gerado')).toHaveValue('')

    await user.selectOptions(screen.getByLabelText('Validade do link'), '7 dias')
    await user.click(screen.getByRole('button', { name: /Gerar link/ }))

    await waitFor(() => expect(screen.getByLabelText('Endereço gerado')).toHaveValue(`${window.location.origin}/l/tok1`))
    expect(linksDaApiFalsa[0]).toMatchObject({ escopo: 'imovel', alvo: imovel.id })
    expect(linksDaApiFalsa[0].expiraEm).not.toBeNull()
    unmount()

    renderizar('/l/tok1', { logado: false })
    await waitFor(() => expect(linksDaApiFalsa[0].visitas).toBe(1))
  })

  it('link expirado avisa o visitante', async () => {
    linksDaApiFalsa.push({ id: '9', token: 'velho', escopo: 'catalogo', alvo: null, expiraEm: '2020-01-01T00:00:00Z', visitas: 0, criadoEm: '2019-12-01T00:00:00Z' })
    renderizar('/l/velho', { logado: false })
    expect(await screen.findByRole('heading', { name: 'Este link expirou.' })).toBeInTheDocument()
    expect(linksDaApiFalsa.at(-1)!.visitas).toBe(0)
  })

  it('perfil sem permissão de publicar não vê o card', () => {
    const corretor = lerDb().usuarios.find((u) => u.papel === 'Corretor' && u.ativo !== false)!
    renderizar('/imoveis', { usuarioId: corretor.id })
    expect(screen.getByRole('heading', { name: 'Imóveis' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Gerar link público' })).not.toBeInTheDocument()
  })
})
