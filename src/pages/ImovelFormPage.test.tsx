import { screen, waitFor } from '@testing-library/react'

import { lerDb } from '../data/db'
import { renderizar } from '../test/utils'

describe('Cadastro de imóvel', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('não publica com campos obrigatórios vazios', async () => {
    const { user } = renderizar('/imoveis/novo')
    const total = lerDb().imoveis.length
    await user.click(screen.getByRole('button', { name: 'Publicar imóvel' }))

    expect(await screen.findByText(/campos destacados antes de publicar/)).toBeInTheDocument()
    expect(screen.getByLabelText('Título do anúncio')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Adicione ao menos uma foto para exibir no catálogo.')).toBeInTheDocument()
    expect(lerDb().imoveis).toHaveLength(total)
  })

  it('calcula a área a partir de frente e fundo', async () => {
    const { user } = renderizar('/imoveis/novo')
    await user.type(screen.getByLabelText('Frente'), '2600')
    await user.type(screen.getByLabelText('Fundo'), '5000')
    expect(screen.getByLabelText('Área total')).toHaveValue('1.300,00')
  })

  it('preenche o endereço pelo CEP e publica o imóvel', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ logradouro: 'Av. Ministro Cirne Lima', bairro: 'Vila Becker', localidade: 'Toledo', uf: 'PR' }),
      }),
    )
    const { user } = renderizar('/imoveis/novo')

    await user.type(screen.getByLabelText('Título do anúncio'), 'Terreno de esquina Biopark')
    await user.type(screen.getByLabelText('Matrícula'), '41902')
    await user.selectOptions(screen.getByLabelText('Loteamento'), 'Biopark Toledo')
    await user.clear(screen.getByLabelText('CEP'))
    await user.type(screen.getByLabelText('CEP'), '85919899')
    await waitFor(() => expect(screen.getByLabelText('Logradouro')).toHaveValue('Av. Ministro Cirne Lima'))
    expect(screen.getByLabelText('CEP')).toHaveValue('85919-899')

    await user.type(screen.getByLabelText('Número'), 's/n')
    await user.type(screen.getByLabelText('Quadra'), '04')
    await user.type(screen.getByLabelText('Lote'), '99')
    await user.type(screen.getByLabelText('Latitude'), '-24.713920')
    await user.type(screen.getByLabelText('Longitude'), '-53.740310')
    await user.type(screen.getByLabelText('Área total'), '130000')
    await user.type(screen.getByLabelText('Valor de tabela'), '45500000')
    await user.type(screen.getByLabelText('Valor mínimo aceito'), '42000000')
    await user.click(screen.getByRole('switch', { name: 'Exibir no catálogo público' }))

    await user.click(screen.getByRole('button', { name: 'Publicar imóvel' }))

    expect(await screen.findByRole('heading', { name: 'Imóveis' })).toBeInTheDocument()
    const salvo = lerDb().imoveis.find((i) => i.titulo === 'Terreno de esquina Biopark')
    expect(salvo).toMatchObject({
      status: 'publicado',
      loteamento: 'Biopark Toledo',
      endereco: { cidade: 'Toledo', uf: 'PR', lote: '99' },
      geo: { lat: -24.71392, lng: -53.74031 },
      valores: { tabela: 455000, minimo: 420000 },
    })
  })

  it('salva rascunho e continua editando o mesmo registro', async () => {
    const { user } = renderizar('/imoveis/novo')
    await user.type(screen.getByLabelText('Título do anúncio'), 'Rascunho de teste')
    await user.click(screen.getByRole('button', { name: /Salvar rascunho/ }))

    expect(await screen.findByText('Rascunho salvo.')).toBeInTheDocument()
    const rascunhos = lerDb().imoveis.filter((i) => i.status === 'rascunho')
    expect(rascunhos).toHaveLength(1)
    expect(await screen.findByRole('heading', { name: 'Rascunho de teste' })).toBeInTheDocument()
  })
})
