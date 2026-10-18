import { fireEvent, screen, within } from '@testing-library/react'

import { lerDb, restaurarDemo } from '../../data/db'
import { renderizar } from '../../test/utils'

const linhas = () => within(screen.getByRole('table')).getAllByRole('row').slice(1)
const dialogo = () => screen.getByRole('dialog')

beforeEach(() => {
  // Só o relógio é falso: o resumo "no ano" e a validação de data dependem de hoje.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 12, 10))
  restaurarDemo()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Lista de vendas', () => {
  it('mostra o resumo calculado e as vendas da mais recente para a mais antiga', () => {
    renderizar('/vendas')

    expect(screen.getByRole('heading', { name: 'Vendas' })).toBeInTheDocument()
    expect(screen.getByText('17 vendas registradas · R$ 4,2M no ano · 2 canceladas')).toBeInTheDocument()
    expect(screen.getByText('Cancelamentos exigem justificativa e ficam registrados na auditoria')).toBeInTheDocument()
    expect(within(screen.getByRole('table')).getAllByRole('columnheader').map((c) => c.textContent)).toEqual([
      'Imóvel',
      'Comprador',
      'Corretor',
      'Valor da venda',
      'Data',
      'Status',
    ])

    const visiveis = linhas()
    expect(visiveis).toHaveLength(8)
    expect(within(visiveis[0]).getAllByRole('cell').map((c) => c.textContent?.replace(/\s/g, ' '))).toEqual([
      'Lote 03 — Qd. 07 · Jd. Europa',
      'Silvana Costa',
      'Gabriela Krüger',
      'R$ 268.000',
      '12/08/2026',
      'Concluída',
    ])
    expect(visiveis[2]).toHaveTextContent('Em escritura')
    expect(visiveis[4]).toHaveTextContent('Cancelada')
    expect(visiveis[7]).toHaveTextContent('Lote 11 — Qd. 06 · Lot. Universitário')
    const datas = visiveis.map((l) => l.querySelector('time')!.getAttribute('datetime')!)
    expect(datas).toEqual([...datas].sort().reverse())
  })

  it('pagina de 8 em 8 com o componente de paginação das listagens', async () => {
    const { user } = renderizar('/vendas')
    expect(screen.getByText('1–8 de 17')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Próxima página' }))
    expect(screen.getByText('9–16 de 17')).toBeInTheDocument()
    expect(linhas()).toHaveLength(8)
    expect(linhas()[0]).toHaveTextContent('Lote 05 — Qd. 02 · Lot. Universitário')

    await user.click(screen.getByRole('button', { name: 'Próxima página' }))
    expect(screen.getByText('17–17 de 17')).toBeInTheDocument()
    expect(linhas()).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Próxima página' })).toBeDisabled()
  })

  it('filtra por status e busca por corretor ignorando acentos, voltando para a primeira página', async () => {
    const { user } = renderizar('/vendas')
    await user.click(screen.getByRole('button', { name: 'Próxima página' }))

    await user.click(screen.getByRole('button', { name: 'Canceladas 2' }))
    expect(linhas()).toHaveLength(2)
    expect(linhas().every((l) => l.textContent?.includes('Cancelada'))).toBe(true)
    expect(screen.queryByText(/de 17$/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Todas 17' }))
    await user.type(screen.getByRole('searchbox', { name: 'Buscar vendas' }), 'gabriela kruger')
    expect(linhas()).toHaveLength(3)
    expect(linhas().every((l) => l.textContent?.includes('Gabriela Krüger'))).toBe(true)

    await user.clear(screen.getByRole('searchbox', { name: 'Buscar vendas' }))
    await user.type(screen.getByRole('searchbox', { name: 'Buscar vendas' }), 'inexistente')
    expect(screen.getByText('Nenhuma venda encontrada para "inexistente".')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeDisabled()
  })

  it('exporta todas as páginas do que está filtrado, com o nome datado', async () => {
    const blobs: Blob[] = []
    const nomes: string[] = []
    URL.createObjectURL = vi.fn((b: Blob) => {
      blobs.push(b)
      return 'blob:vendas'
    })
    URL.revokeObjectURL = vi.fn()
    const clique = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      nomes.push(this.download)
    })
    const { user } = renderizar('/vendas')

    await user.click(screen.getByRole('button', { name: 'Exportar CSV' }))
    await user.click(screen.getByRole('button', { name: 'Concluídas 14' }))
    await user.click(screen.getByRole('button', { name: 'Exportar CSV' }))

    expect(nomes).toEqual(['vendas-2026-10-12.csv', 'vendas-2026-10-12.csv'])
    const [todas, concluidas] = await Promise.all(blobs.map(lerTexto))
    expect(todas.trimEnd().split('\r\n')).toHaveLength(18)
    const linhasConcluidas = concluidas.trimEnd().split('\r\n')
    expect(linhasConcluidas).toHaveLength(15)
    expect(linhasConcluidas.slice(1).every((l) => l.endsWith(';Concluída'))).toBe(true)
    clique.mockRestore()
  })

  it('abre o detalhe pelo link da linha', async () => {
    const { user } = renderizar('/vendas')
    await user.click(screen.getByRole('link', { name: /^Lote 03 — Qd\. 07 · Jd\. Europa — detalhes da venda/ }))
    expect(await screen.findByRole('heading', { name: 'Venda VD-2026-0092' })).toBeInTheDocument()
  })
})

describe('Detalhe da venda', () => {
  it('administrador cancela com justificativa obrigatória e o cancelamento entra na auditoria', async () => {
    const { user } = renderizar('/vendas/ven-1')
    await user.click(screen.getByRole('button', { name: 'Cancelar venda' }))
    const confirmar = within(dialogo()).getByRole('button', { name: 'Cancelar venda' })

    await user.click(confirmar)
    expect(within(dialogo()).getByText('Informe a justificativa do cancelamento.')).toBeInTheDocument()
    await user.type(within(dialogo()).getByLabelText('Justificativa'), 'curta')
    await user.click(confirmar)
    expect(within(dialogo()).getByText('A justificativa precisa ter pelo menos 10 caracteres.')).toBeInTheDocument()
    expect(lerDb().vendas.find((v) => v.id === 'ven-1')?.status).toBe('concluida')

    await user.type(within(dialogo()).getByLabelText('Justificativa'), ' — distrato assinado pelo comprador')
    await user.click(confirmar)

    expect(await screen.findByText('Venda cancelada. O imóvel fica bloqueado até ser reabilitado.')).toBeInTheDocument()
    expect(screen.getByText('Venda cancelada: não pode ser reaberta nem editada.')).toBeInTheDocument()
    const auditoria = within(screen.getAllByRole('table').at(-1)!).getAllByRole('row').at(-1)!
    expect(auditoria).toHaveTextContent('Venda cancelada')
    expect(auditoria).toHaveTextContent('Ayran Bade')
    expect(auditoria).toHaveTextContent('Concluída → Cancelada')
    expect(auditoria).toHaveTextContent('curta — distrato assinado pelo comprador')
    expect(screen.queryByRole('button', { name: 'Cancelar venda' })).not.toBeInTheDocument()
  })

  it('fecha o modal com Esc sem cancelar a venda', async () => {
    const { user } = renderizar('/vendas/ven-1')
    await user.click(screen.getByRole('button', { name: 'Cancelar venda' }))
    fireEvent(dialogo(), new Event('cancel', { cancelable: true }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(lerDb().vendas.find((v) => v.id === 'ven-1')?.status).toBe('concluida')
  })

  it('conclui a escritura de uma venda Em escritura', async () => {
    const { user } = renderizar('/vendas/ven-3')
    await user.click(screen.getByRole('button', { name: 'Concluir escritura' }))
    await user.click(within(dialogo()).getByRole('button', { name: 'Concluir escritura' }))

    expect(await screen.findByText('Escritura concluída.')).toBeInTheDocument()
    expect(lerDb().vendas.find((v) => v.id === 'ven-3')?.status).toBe('concluida')
    expect(within(screen.getAllByRole('table').at(-1)!).getAllByRole('row').at(-1)).toHaveTextContent('Em escritura → Concluída')
    expect(screen.queryByRole('button', { name: 'Concluir escritura' })).not.toBeInTheDocument()
  })

  it('venda cancelada não oferece nenhuma ação', () => {
    renderizar('/vendas/ven-5')
    expect(screen.getByText('Venda cancelada: não pode ser reaberta nem editada.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancelar venda' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Concluir escritura' })).not.toBeInTheDocument()
  })

  it('as ações aparecem só para perfis com permissão', () => {
    const { unmount } = renderizar('/vendas/ven-3')
    expect(screen.getByRole('button', { name: 'Cancelar venda' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Concluir escritura' })).toBeInTheDocument()
    unmount()

    // Gerente comercial conclui a escritura, mas não cancela.
    const gerente = renderizar('/vendas/ven-3', { usuarioId: 'usr-3' })
    expect(screen.queryByRole('button', { name: 'Cancelar venda' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Concluir escritura' })).toBeInTheDocument()
    gerente.unmount()

    renderizar('/vendas/ven-3', { usuarioId: 'usr-4' })
    expect(screen.getByRole('heading', { name: /^Venda VD-/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancelar venda' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Concluir escritura' })).not.toBeInTheDocument()
  })
})

describe('Registrar venda', () => {
  it('aponta os obrigatórios e começa com status Em escritura', async () => {
    const { user } = renderizar('/vendas/nova')
    expect(screen.getByLabelText('Status inicial')).toHaveDisplayValue('Em escritura')

    await user.click(screen.getByRole('button', { name: 'Registrar venda' }))
    expect(screen.getByText('Selecione o loteamento.')).toBeInTheDocument()
    expect(screen.getByText('Selecione a quadra e o lote.')).toBeInTheDocument()
    expect(screen.getByText('Selecione o comprador.')).toBeInTheDocument()
    expect(screen.getByText('Selecione o corretor.')).toBeInTheDocument()
    expect(screen.getByText('Informe um valor maior que zero.')).toBeInTheDocument()
    expect(lerDb().vendas).toHaveLength(17)
  })

  it('impede imóvel já vendido e data futura', async () => {
    const { user } = renderizar('/vendas/nova')
    await user.selectOptions(screen.getByLabelText('Loteamento'), 'Jd. Europa')
    await user.selectOptions(screen.getByLabelText('Quadra / Lote'), 'Qd. 07 — Lote 03 (Vendido)')
    expect(screen.getByText('Este imóvel já tem uma venda registrada.')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Data da venda'), { target: { value: '2026-10-13' } })
    await user.click(screen.getByRole('button', { name: 'Registrar venda' }))
    expect(screen.getByText('A data da venda não pode estar no futuro.')).toBeInTheDocument()
    expect(lerDb().vendas).toHaveLength(17)
  })

  it('registra a venda, marca o imóvel como Vendido e abre o detalhe', async () => {
    const db = lerDb()
    const ocupados = new Set([...db.propostas.map((p) => p.imovelId), ...db.reservas.map((r) => r.imovelId)])
    const lote = db.imoveis.find(
      (i) => i.loteamento === 'Jd. Porto Alegre' && i.situacao === 'disponivel' && i.matricula && !ocupados.has(i.id),
    )!
    const { user } = renderizar('/vendas/nova')

    await user.selectOptions(screen.getByLabelText('Loteamento'), 'Jd. Porto Alegre')
    await user.selectOptions(screen.getByLabelText('Quadra / Lote'), lote.id)
    await user.selectOptions(screen.getByLabelText('Comprador'), 'Silvana Costa')
    await user.selectOptions(screen.getByLabelText('Corretor'), 'Gabriela Krüger')
    await user.clear(screen.getByLabelText('Valor da venda'))
    await user.type(screen.getByLabelText('Valor da venda'), '15000000')
    await user.click(screen.getByRole('button', { name: 'Registrar venda' }))

    expect(await screen.findByRole('heading', { name: 'Venda VD-2026-0093' })).toBeInTheDocument()
    const venda = lerDb().vendas.at(-1)!
    expect(venda).toMatchObject({ imovelId: lote.id, valor: 150_000, status: 'em_escritura' })
    expect(lerDb().imoveis.find((i) => i.id === lote.id)?.situacao).toBe('vendido')
    expect(within(screen.getAllByRole('table').at(-1)!).getAllByRole('row').at(-1)).toHaveTextContent('Venda registrada')
  })
})

function lerTexto(blob: Blob) {
  return new Promise<string>((resolve) => {
    const leitor = new FileReader()
    leitor.onload = () => resolve(String(leitor.result))
    leitor.readAsText(blob)
  })
}
