import { screen, within } from '@testing-library/react'

import { lerDb } from '../../data/db'
import { reservaAtiva } from '../../data/selectors'
import { calcularCondicoes, propostaAberta } from '../../lib/propostas'
import { renderizar } from '../../test/utils'

const texto = (s: string | null | undefined) => (s ?? '').replace(/\s/g, ' ')
const linhas = () => within(screen.getAllByRole('table')[0]).getAllByRole('row').slice(1)
const lote12 = () => lerDb().propostas[0]
const lote31 = () => lerDb().propostas.find((p) => p.situacao === 'aguardando_diretoria')!
const reservaLivre = () => {
  const db = lerDb()
  return db.reservas.find((r) => reservaAtiva(r, Date.now()) && !propostaAberta(db.propostas, r.id, Date.now()))!
}

describe('Lista de propostas', () => {
  it('lista as propostas com valor, situação e filtros', async () => {
    const { user } = renderizar('/propostas')
    expect(screen.getByRole('heading', { name: 'Propostas' })).toBeInTheDocument()
    expect(linhas()).toHaveLength(lerDb().propostas.length)
    expect(screen.getByRole('button', { name: 'Aguardando você 2' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Expiradas 1' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Aguardando você 2' }))
    expect(linhas()).toHaveLength(2)
    const linha31 = linhas().find((l) => l.textContent?.includes('Lote 31'))!
    expect(texto(linha31.textContent)).toContain('R$ 420.000')
    expect(within(linha31).getByText('Aguardando diretoria')).toBeInTheDocument()
  })

  it('busca por código ou cliente e abre o detalhe', async () => {
    const { user } = renderizar('/propostas')
    await user.type(screen.getByRole('searchbox', { name: 'Buscar propostas' }), 'construtora')
    expect(linhas()).toHaveLength(1)
    await user.click(screen.getByRole('link', { name: `Detalhes da proposta ${lote31().codigo}` }))
    expect(await screen.findByRole('heading', { name: 'Lote 31 — Biopark Toledo' })).toBeInTheDocument()
  })
})

describe('Nova proposta', () => {
  it('sem reserva, pede a escolha de uma reserva ativa', async () => {
    const { user } = renderizar('/propostas/nova')
    expect(screen.getByRole('heading', { name: 'Selecione a reserva ativa' })).toBeInTheDocument()
    const reserva = reservaLivre()
    await user.selectOptions(screen.getByLabelText('Reserva ativa'), reserva.id)
    await user.click(screen.getByRole('button', { name: 'Gerar proposta' }))
    expect(await screen.findByLabelText('Reserva vinculada')).toHaveValue(reserva.codigo)
  })

  it('explica quando a reserva não está ativa (RF17)', () => {
    const cancelada = lerDb().reservas.find((r) => r.status === 'cancelada')!
    renderizar(`/propostas/nova?reserva=${cancelada.id}`)
    expect(screen.getByRole('heading', { name: `A reserva ${cancelada.codigo} não está ativa` })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Enviar para aprovação' })).not.toBeInTheDocument()
  })

  it('leva à proposta existente quando a reserva já tem uma em andamento', () => {
    renderizar(`/propostas/nova?reserva=${lote12().reservaId}`)
    expect(screen.getByRole('heading', { name: /já tem a proposta PROP-\d{4}-0311/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver proposta' })).toBeInTheDocument()
  })

  it('recalcula os valores, valida e envia para aprovação', async () => {
    const reserva = reservaLivre()
    const imovel = lerDb().imoveis.find((i) => i.id === reserva.imovelId)!
    const tabela = imovel.valores.tabela!
    const { user } = renderizar(`/propostas/nova?reserva=${reserva.id}`)

    expect(screen.getByText(`Gerada a partir da reserva ativa ${reserva.codigo} · RF17`)).toBeInTheDocument()
    expect(screen.getByLabelText('Imóvel')).toHaveAttribute('readonly')
    expect(screen.getByLabelText('Cliente')).toHaveAttribute('readonly')

    const desconto = screen.getByLabelText('Desconto (%)')
    await user.clear(desconto)
    await user.type(desconto, '3')
    await user.type(screen.getByLabelText('Entrada'), '5000000')
    const parcelas = screen.getByLabelText('Nº de parcelas')
    await user.clear(parcelas)
    await user.type(parcelas, '24')

    const k = calcularCondicoes({ valorTabela: tabela, descontoPercentual: 3, entrada: 50_000, parcelas: 24 })
    const reais = (v: number) => `R$ ${Math.trunc(v).toLocaleString('pt-BR')}`
    expect(texto((screen.getByLabelText('Desconto em R$') as HTMLInputElement).value)).toBe(reais(k.descontoValor))
    expect(texto((screen.getByLabelText('Valor proposto') as HTMLInputElement).value)).toBe(reais(k.valorProposto))
    expect(texto((screen.getByLabelText('Parcelas') as HTMLInputElement).value)).toBe(`24x de ${reais(k.valorParcela)}`)
    expect(screen.getByLabelText('Acima da alçada')).toHaveValue('Sim — exige aprovação')

    await user.click(screen.getByRole('button', { name: 'Enviar para aprovação' }))
    expect(screen.getByText('Desconto acima da alçada: selecione o aprovador.')).toBeInTheDocument()
    expect(propostaAberta(lerDb().propostas, reserva.id, Date.now())).toBeUndefined()

    await user.selectOptions(screen.getByLabelText('Aprovador'), 'Gabriela Krüger — Gerente comercial')
    await user.click(screen.getByRole('button', { name: 'Enviar para aprovação' }))

    expect(await screen.findByText(/^Proposta PROP-\d{4}-\d{4} enviada para aprovação\.$/)).toBeInTheDocument()
    const criada = propostaAberta(lerDb().propostas, reserva.id, Date.now())!
    expect(criada.situacao).toBe('enviada')
    expect(criada.versoes[0].condicoes).toMatchObject({ descontoPercentual: 3, entrada: 50_000, parcelas: 24 })
    expect(await screen.findByText('Etapa 2 de 3')).toBeInTheDocument()
  })

  it('bloqueia na hora um valor abaixo do mínimo aceito do imóvel', async () => {
    const reserva = reservaLivre()
    const { user } = renderizar(`/propostas/nova?reserva=${reserva.id}`)
    const desconto = screen.getByLabelText('Desconto (%)')
    await user.clear(desconto)
    await user.type(desconto, '20')
    expect(screen.getByText(/^Abaixo do mínimo aceito para este imóvel/)).toBeInTheDocument()
  })

  it('salva rascunho sem enviar', async () => {
    const reserva = reservaLivre()
    const { user } = renderizar(`/propostas/nova?reserva=${reserva.id}`)
    await user.click(screen.getByRole('button', { name: 'Salvar rascunho' }))
    expect(await screen.findByText(/^Rascunho PROP-\d{4}-\d{4} salvo/)).toBeInTheDocument()
    expect(propostaAberta(lerDb().propostas, reserva.id, Date.now())?.situacao).toBe('rascunho')
    expect(await screen.findByRole('link', { name: 'Continuar edição' })).toBeInTheDocument()
    expect(screen.getByText('Ainda não enviada para aprovação')).toBeInTheDocument()
  })
})

describe('Detalhe da proposta', () => {
  it('mostra valores, alerta de mínimo e o fluxo com a etapa do usuário', () => {
    renderizar(`/propostas/${lote31().id}`)
    expect(screen.getByRole('heading', { name: 'Lote 31 — Biopark Toledo' })).toBeInTheDocument()
    expect(screen.getAllByText('Aguardando diretoria')[0]).toBeInTheDocument()
    expect(screen.getByText('−7,7%')).toBeInTheDocument()
    expect(screen.getByText('A proposta atinge exatamente o valor mínimo autorizado para este lote.')).toBeInTheDocument()
    expect(screen.getByText('Etapa 3 de 4')).toBeInTheDocument()
    expect(screen.getByText('Aguardando você')).toBeInTheDocument()
    expect(texto(screen.getByText(/^R\$\s126\.000/).textContent)).toBe('R$ 126.000 (30%)')
    expect(screen.getByText('1.300,00 m²')).toBeInTheDocument()
    expect(screen.getByText('7 dias úteis', { exact: false })).toBeInTheDocument()
  })

  it('os botões de decisão aparecem só para o aprovador da etapa atual', () => {
    const { unmount } = renderizar(`/propostas/${lote31().id}`)
    expect(screen.getByRole('button', { name: 'Aprovar proposta' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Recusar proposta' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Contraproposta' })).toBeInTheDocument()
    unmount()

    // O gestor não decide a etapa da diretoria…
    const gestor = renderizar(`/propostas/${lote31().id}`, { usuarioId: 'usr-2' })
    expect(screen.queryByRole('button', { name: 'Aprovar proposta' })).not.toBeInTheDocument()
    gestor.unmount()

    // …mas decide a análise comercial do Lote 12, que o administrador só acompanha.
    const gestorLote12 = renderizar(`/propostas/${lote12().id}`, { usuarioId: 'usr-2' })
    expect(screen.getByRole('button', { name: 'Aprovar proposta' })).toBeInTheDocument()
    gestorLote12.unmount()
    renderizar(`/propostas/${lote12().id}`)
    expect(screen.queryByRole('button', { name: 'Aprovar proposta' })).not.toBeInTheDocument()
    expect(screen.getByText('Aguardando decisão')).toBeInTheDocument()
  })

  it('aprovar a última etapa deixa a proposta Aprovada e o contrato pendente', async () => {
    const { user } = renderizar(`/propostas/${lote31().id}`)
    await user.click(screen.getByRole('button', { name: 'Aprovar proposta' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Aprovar' }))

    expect(await screen.findByText(/^Proposta aprovada\. Venda VD-\d{4}-\d{4} registrada/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aprovar proposta' })).not.toBeInTheDocument()
    expect(screen.getByText('Pendente · geração automática')).toBeInTheDocument()
    expect(screen.getByText(/^Proposta aprovada — Ayran Bade$/)).toBeInTheDocument()
  })

  it('recusar exige motivo e grava no histórico', async () => {
    const id = lote31().id
    const { user } = renderizar(`/propostas/${id}`)
    await user.click(screen.getByRole('button', { name: 'Recusar proposta' }))
    const dialogo = screen.getByRole('dialog')
    await user.click(within(dialogo).getByRole('button', { name: 'Recusar proposta' }))
    expect(within(dialogo).getByText('Informe o motivo da recusa.')).toBeInTheDocument()

    await user.type(within(dialogo).getByLabelText('Motivo da recusa'), 'Desconto acima da política')
    await user.click(within(dialogo).getByRole('button', { name: 'Recusar proposta' }))
    expect(await screen.findByText('Proposta recusada. O corretor será avisado.')).toBeInTheDocument()
    expect(screen.getByText('Aprovação da diretoria: Desconto acima da política')).toBeInTheDocument()
    expect(screen.getByText('Recusada', { selector: '.badge' })).toBeInTheDocument()
    expect(lerDb().propostas.find((p) => p.id === id)?.situacao).toBe('recusada')
  })

  it('contraproposta abre o formulário de nova versão com os valores atuais', async () => {
    const { user } = renderizar(`/propostas/${lote31().id}`)
    await user.click(screen.getByRole('button', { name: 'Contraproposta' }))
    expect(await screen.findByRole('heading', { name: /— Contraproposta v3$/ })).toBeInTheDocument()
    expect(texto((screen.getByLabelText('Valor proposto') as HTMLInputElement).value)).toBe('R$ 420.000')
  })
})

describe('Versões da proposta', () => {
  it('mostra a versão atual, o histórico e as decisões e prazos', () => {
    renderizar(`/propostas/${lote12().id}/versoes`)
    expect(screen.getByRole('heading', { name: /^PROP-\d{4}-0311 — Versões$/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Versão atual — v3' })).toBeInTheDocument()
    const [historico, decisoes] = screen.getAllByRole('table')
    const versoes = within(historico).getAllByRole('row').slice(1)
    expect(versoes.map((l) => (l as HTMLTableRowElement).cells[0].textContent)).toEqual(['v3', 'v2', 'v1'])
    expect(within(versoes[1]).getByText('Parcelamento alterado de 18x para 24x')).toBeInTheDocument()
    expect(within(versoes[1]).getByText('Substituída')).toBeInTheDocument()
    expect(within(decisoes).getByText('Gestor solicitou comparação com o Jd. Europa')).toBeInTheDocument()
    expect(within(decisoes).getByText('Prazo final')).toBeInTheDocument()
  })

  it('compara duas versões destacando o que mudou', async () => {
    const { user } = renderizar(`/propostas/${lote12().id}/versoes`)
    await user.click(screen.getByRole('button', { name: 'Comparar versões' }))
    const dialogo = screen.getByRole('dialog')
    const linha = (rotulo: string) => within(dialogo).getByRole('rowheader', { name: new RegExp(`^${rotulo}`) }).closest('tr')!
    expect(linha('Desconto')).toHaveClass('comparativo__mudou')
    expect(within(linha('Desconto')).getByText('Alterado')).toBeInTheDocument()
    expect(linha('Parcelamento')).not.toHaveClass('comparativo__mudou')

    await user.selectOptions(within(dialogo).getByLabelText('Versão A'), '1')
    await user.selectOptions(within(dialogo).getByLabelText('Versão B'), '2')
    expect(linha('Parcelamento')).toHaveClass('comparativo__mudou')
    expect(linha('Desconto')).not.toHaveClass('comparativo__mudou')
  })

  it('nova versão cria v4, gera "O que mudou" e mantém a v3 somente leitura', async () => {
    const v3 = structuredClone(lote12().versoes[2])
    const { user } = renderizar(`/propostas/${lote12().id}/versoes`)
    await user.click(screen.getByRole('link', { name: 'Nova versão' }))

    expect(await screen.findByRole('heading', { name: /— Nova versão v4$/ })).toBeInTheDocument()
    const parcelas = screen.getByLabelText('Nº de parcelas')
    await user.clear(parcelas)
    await user.type(parcelas, '36')
    expect(screen.getByLabelText('O que mudou')).toHaveValue('Parcelamento alterado de 24x para 36x')
    await user.type(screen.getByLabelText('Comentário do autor (opcional)'), 'Cliente pediu prazo maior.')
    await user.click(screen.getByRole('button', { name: 'Enviar nova versão' }))

    expect(await screen.findByRole('heading', { name: 'Versão atual — v4' })).toBeInTheDocument()
    const versoes = lote12().versoes
    expect(versoes).toHaveLength(4)
    expect(versoes[2].condicoes).toEqual(v3.condicoes)
    expect(versoes[2].situacao).toBe('substituida')
    expect(screen.getByText('“Cliente pediu prazo maior.”')).toBeInTheDocument()
  })
})
