import { screen, within } from '@testing-library/react'

import { lerDb } from '../../data/db'
import { renderizar } from '../../test/utils'

const lote12 = () =>
  lerDb().imoveis.find((i) => i.loteamento === 'Lot. Universitário' && i.endereco.quadra === '04' && i.endereco.lote === '12')!
const disponivel = () => lerDb().imoveis.find((i) => i.situacao === 'disponivel')!

describe('Páginas do lote', () => {
  it('histórico mostra a linha do tempo em ordem e é só leitura', async () => {
    renderizar(`/imoveis/${lote12().id}/historico`)
    expect(screen.getByRole('heading', { name: 'Histórico — Lote 12, Qd. 04' })).toBeInTheDocument()
    const linhas = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    expect(linhas[0]).toHaveTextContent('Cadastro')
    expect(linhas.some((l) => l.textContent?.includes('Reabilitação'))).toBe(true)
    expect(screen.queryByRole('button', { name: /excluir|editar/i })).not.toBeInTheDocument()
  })

  it('bloqueia um imóvel disponível exigindo justificativa', async () => {
    const imovel = disponivel()
    const { user } = renderizar(`/imoveis/${imovel.id}/acoes`)

    await user.click(screen.getByRole('button', { name: 'Confirmar ação' }))
    expect(screen.getByText('Explique o bloqueio (mínimo de 10 caracteres).')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Justificativa'), 'Averbação ainda não saiu no cartório.')
    await user.click(screen.getByRole('button', { name: 'Confirmar ação' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar' }))

    expect(await screen.findByRole('heading', { name: /^Histórico/ })).toBeInTheDocument()
    const atualizado = lerDb().imoveis.find((i) => i.id === imovel.id)!
    expect(atualizado.situacao).toBe('bloqueado')
    expect(atualizado.publicacao.catalogo).toBe(false)
    expect(lerDb().historico.some((e) => e.imovelId === imovel.id && e.tipo === 'Bloqueio')).toBe(true)
  })

  it('envia documento do mesmo tipo como nova versão', async () => {
    const imovel = lote12()
    const { user } = renderizar(`/imoveis/${imovel.id}/documentos`)
    await user.selectOptions(screen.getByLabelText('Tipo de documento'), 'Matrícula atualizada')
    const arquivo = new File(['conteudo'], 'matricula-v3.pdf', { type: 'application/pdf' })
    await user.upload(screen.getByLabelText('Selecionar documento'), arquivo)
    await user.click(screen.getByRole('button', { name: /Enviar arquivo/ }))

    expect(await screen.findByText(/enviado como versão 3/)).toBeInTheDocument()
    const docs = lerDb().documentos.filter((d) => d.imovelId === imovel.id && d.tipo === 'Matrícula atualizada')
    expect(docs.map((d) => [d.versao, d.substituido])).toEqual([
      [2, true],
      [3, false],
    ])
  })
})
