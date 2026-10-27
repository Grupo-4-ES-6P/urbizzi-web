import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { lerDb } from '../../data/db'
import { renderizar } from '../../test/utils'

const noCatalogo = () =>
  lerDb().imoveis.filter((i) => i.status === 'publicado' && i.publicacao.catalogo && i.situacao === 'disponivel')

describe('Catálogo público', () => {
  it('lista só terrenos disponíveis e publicados, sem exigir login', () => {
    renderizar('/terrenos', { logado: false })
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(`${noCatalogo().length} terrenos`)
    expect(screen.queryByRole('link', { name: 'Imóveis' })).not.toBeInTheDocument()
  })

  it('filtra por empreendimento ao clicar em Buscar', async () => {
    const { user } = renderizar('/terrenos', { logado: false })
    await user.selectOptions(screen.getByLabelText('Empreendimento'), 'Jd. Europa')
    await user.click(screen.getByRole('button', { name: 'Buscar' }))

    const esperados = noCatalogo().filter((i) => i.loteamento === 'Jd. Europa')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(`${esperados.length} ${esperados.length === 1 ? 'terreno' : 'terrenos'}`)
    expect(screen.getAllByRole('button', { name: 'Tenho interesse' })).toHaveLength(Math.min(10, esperados.length))
  })

  it('mostra aviso e limpa os filtros quando nada é encontrado', async () => {
    const { user } = renderizar('/terrenos?q=nenhum-terreno-assim', { logado: false })
    expect(screen.getByRole('heading', { name: 'Nenhum terreno com esses filtros' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Limpar filtros' }))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(`${noCatalogo().length} terrenos`)
  })

  it('registra interesse a partir do card do terreno', async () => {
    const { user } = renderizar('/terrenos', { logado: false })
    await user.click(screen.getAllByRole('button', { name: 'Tenho interesse' })[0])
    const dialogo = screen.getByRole('dialog')
    await user.click(within(dialogo).getByRole('button', { name: 'Enviar interesse' }))
    expect(within(dialogo).getByText('Informe nome e sobrenome.')).toBeInTheDocument()

    await user.type(within(dialogo).getByLabelText('Nome completo'), 'Marina Ferreira Duarte')
    await user.type(within(dialogo).getByLabelText('E-mail'), 'marina@email.com')
    await user.type(within(dialogo).getByLabelText('Telefone'), '45998124477')
    await user.click(within(dialogo).getByRole('button', { name: 'Enviar interesse' }))

    expect(await screen.findByText('Interesse enviado!')).toBeInTheDocument()
    expect(lerDb().interesses.some((i) => i.nome === 'Marina Ferreira Duarte')).toBe(true)
  })
})
