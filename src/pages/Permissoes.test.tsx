import { screen, within } from '@testing-library/react'

import { atualizarDb, lerDb } from '../data/db'
import { reservaAtiva } from '../data/selectors'
import { podeDecidirProposta } from '../lib/permissoes'
import { propostaAberta } from '../lib/propostas'
import { aprovarProposta } from '../services/propostas'
import { renderizar } from '../test/utils'

// Usuários do seed por perfil.
const ADMIN = 'usr-1'
const GERENTE = 'usr-2'
const CORRETOR = 'usr-4'
const COLETOR = 'usr-6'

const menu = () => screen.getByRole('complementary', { name: 'Menu principal' })
const botao = (nome: string) => screen.queryByRole('button', { name: nome })
const link = (nome: string) => screen.queryByRole('link', { name: nome })
const imovelDisponivel = () => lerDb().imoveis.find((i) => i.situacao === 'disponivel' && i.status === 'publicado')!
const reservaSemProposta = () => {
  const db = lerDb()
  const agora = Date.now()
  return db.reservas.find((r) => reservaAtiva(r, agora) && !propostaAberta(db.propostas, r.id, agora))!
}
const lote12 = () => lerDb().propostas[0]
const lote31 = () => lerDb().propostas.find((p) => p.situacao === 'aguardando_diretoria')!

describe('rotas de criação voltam ao dashboard sem a permissão', () => {
  it.each([
    ['/imoveis/novo', CORRETOR],
    ['/imoveis/loteamentos/novo', CORRETOR],
    ['/clientes/novo', COLETOR],
    ['/reservas/nova', COLETOR],
    ['/propostas/nova', COLETOR],
    ['/vendas/nova', CORRETOR],
    ['/relatorios', CORRETOR],
  ])('%s para o usuário %s', (rota, usuarioId) => {
    renderizar(rota, { usuarioId })
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
  })

  it.each([
    ['/imoveis/novo', COLETOR, 'Cadastrar imóvel'],
    ['/clientes/novo', CORRETOR, 'Novo cliente'],
    ['/reservas/nova', CORRETOR, 'Nova reserva'],
    ['/vendas/nova', GERENTE, 'Registrar venda'],
  ])('%s abre para quem tem a permissão (%s)', (rota, usuarioId, titulo) => {
    renderizar(rota, { usuarioId })
    expect(screen.getByRole('heading', { level: 1, name: titulo })).toBeInTheDocument()
  })
})

describe('sidebar', () => {
  it('Relatórios só para Administrador e Gerente', () => {
    const { unmount } = renderizar('/dashboard', { usuarioId: GERENTE })
    expect(within(menu()).getByRole('link', { name: 'Relatórios' })).toBeInTheDocument()
    unmount()
    renderizar('/dashboard', { usuarioId: CORRETOR })
    expect(within(menu()).queryByRole('link', { name: 'Relatórios' })).not.toBeInTheDocument()
    // Os módulos sem ação continuam visíveis, só para leitura.
    expect(within(menu()).getByRole('link', { name: 'Vendas' })).toBeInTheDocument()
  })
})

describe('Imóveis', () => {
  it('Corretor só visualiza: sem cadastro, importação nem edição', () => {
    const { unmount } = renderizar('/imoveis', { usuarioId: CORRETOR })
    expect(link('Novo imóvel')).not.toBeInTheDocument()
    expect(botao('Importar planilha')).not.toBeInTheDocument()
    unmount()

    renderizar(`/imoveis/${imovelDisponivel().id}`, { usuarioId: CORRETOR })
    expect(screen.getByText('Somente leitura: seu perfil não edita imóveis.')).toBeInTheDocument()
    expect(botao('Salvar alterações')).not.toBeInTheDocument()
    expect(botao('Excluir')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Título do anúncio')).toBeDisabled()
  })

  it('Coletor cadastra, mas não publica no catálogo', () => {
    renderizar('/imoveis/novo', { usuarioId: COLETOR })
    const catalogo = screen.getByRole('switch', { name: 'Exibir no catálogo público' })
    expect(catalogo).toBeDisabled()
    expect(catalogo).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('switch', { name: 'Aceitar reservas online' })).toBeDisabled()
    expect(screen.getByText('Só Administrador e Gerente comercial publicam imóveis no catálogo público.')).toBeInTheDocument()
    expect(screen.getByLabelText('Título do anúncio')).toBeEnabled()
  })

  it('Gerente publica no catálogo', () => {
    renderizar('/imoveis/novo', { usuarioId: GERENTE })
    expect(screen.getByRole('switch', { name: 'Exibir no catálogo público' })).toBeEnabled()
  })

  it('bloquear e reabilitar ficam com Administrador e Gerente', () => {
    const { unmount } = renderizar(`/imoveis/${imovelDisponivel().id}/acoes`, { usuarioId: COLETOR })
    expect(screen.getByText('Seu perfil não tem permissão para bloquear imóveis.')).toBeInTheDocument()
    unmount()
    renderizar(`/imoveis/${imovelDisponivel().id}/acoes`, { usuarioId: GERENTE })
    expect(screen.queryByText('Seu perfil não tem permissão para bloquear imóveis.')).not.toBeInTheDocument()
  })

  it('documentos: Corretor não envia; Coletor envia sem publicar no catálogo', () => {
    const { unmount } = renderizar(`/imoveis/${imovelDisponivel().id}/documentos`, { usuarioId: CORRETOR })
    expect(botao('Enviar arquivo')).not.toBeInTheDocument()
    unmount()
    renderizar(`/imoveis/${imovelDisponivel().id}/documentos`, { usuarioId: COLETOR })
    expect(botao('Enviar arquivo')).toBeInTheDocument()
    expect(screen.getByLabelText('Visível no catálogo')).toBeDisabled()
  })

  it('loteamentos: Corretor não cria nem edita', () => {
    const { unmount } = renderizar('/imoveis/loteamentos', { usuarioId: CORRETOR })
    expect(link('Novo loteamento')).not.toBeInTheDocument()
    expect(link('Nova quadra')).not.toBeInTheDocument()
    unmount()
    renderizar(`/imoveis/loteamentos/${lerDb().loteamentos[0].id}`, { usuarioId: CORRETOR })
    expect(screen.getByText('Somente leitura: seu perfil não edita loteamentos.')).toBeInTheDocument()
    expect(botao('Salvar loteamento')).not.toBeInTheDocument()
  })
})

describe('Clientes', () => {
  it('Coletor só visualiza; Corretor gerencia', () => {
    const { unmount } = renderizar('/clientes', { usuarioId: COLETOR })
    expect(link('Novo cliente')).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    unmount()

    const cliente = lerDb().clientes[0]
    const leitura = renderizar(`/clientes/${cliente.id}`, { usuarioId: COLETOR })
    expect(screen.getByText('Somente leitura: seu perfil não edita clientes.')).toBeInTheDocument()
    expect(botao('Salvar alterações')).not.toBeInTheDocument()
    leitura.unmount()

    renderizar('/clientes', { usuarioId: CORRETOR })
    expect(link('Novo cliente')).toBeInTheDocument()
    expect(screen.getAllByRole('checkbox').length).toBeGreaterThan(0)
  })
})

describe('Reservas', () => {
  it('Corretor reserva e renova, mas não cancela nem exporta', () => {
    const { unmount } = renderizar('/reservas', { usuarioId: CORRETOR })
    expect(link('Nova reserva')).toBeInTheDocument()
    expect(botao('Exportar CSV')).not.toBeInTheDocument()
    unmount()

    renderizar(`/reservas/${reservaSemProposta().id}`, { usuarioId: CORRETOR })
    expect(botao('Renovar reserva')).toBeInTheDocument()
    expect(link('Gerar proposta')).toBeInTheDocument()
    expect(botao('Cancelar reserva')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Cancelar reserva' })).not.toBeInTheDocument()
  })

  it('Coletor só visualiza; Gerente cancela e exporta', () => {
    const { unmount } = renderizar(`/reservas/${reservaSemProposta().id}`, { usuarioId: COLETOR })
    expect(botao('Renovar reserva')).not.toBeInTheDocument()
    expect(botao('Cancelar reserva')).not.toBeInTheDocument()
    expect(link('Gerar proposta')).not.toBeInTheDocument()
    unmount()

    const gerente = renderizar(`/reservas/${reservaSemProposta().id}`, { usuarioId: GERENTE })
    expect(botao('Cancelar reserva')).toBeInTheDocument()
    gerente.unmount()
    renderizar('/reservas', { usuarioId: GERENTE })
    expect(botao('Exportar CSV')).toBeInTheDocument()
  })
})

describe('Propostas', () => {
  it('Coletor não cria proposta', () => {
    renderizar('/propostas', { usuarioId: COLETOR })
    expect(link('Nova proposta')).not.toBeInTheDocument()
  })

  it('o responsável que perde o perfil de aprovador não decide mais', async () => {
    const proposta = lote12()
    const { unmount } = renderizar(`/propostas/${proposta.id}`, { usuarioId: GERENTE })
    expect(botao('Aprovar proposta')).toBeInTheDocument()
    unmount()

    atualizarDb((db) => ({ ...db, usuarios: db.usuarios.map((u) => (u.id === GERENTE ? { ...u, papel: 'Corretor' } : u)) }))
    renderizar(`/propostas/${proposta.id}`, { usuarioId: GERENTE })
    expect(botao('Aprovar proposta')).not.toBeInTheDocument()
    await expect(aprovarProposta(proposta.id, { id: GERENTE, nome: 'Arthur Pacheco' })).rejects.toThrow(
      'Somente o responsável pela etapa atual pode decidir esta proposta.',
    )
  })

  it('a etapa da diretoria exige a permissão de desconto acima da alçada', () => {
    const agora = Date.now()
    expect(podeDecidirProposta(lote31(), { id: ADMIN, papel: 'Administrador' }, agora, lerDb().permissoes)).toBe(true)
    expect(podeDecidirProposta(lote31(), { id: ADMIN, papel: 'Gerente comercial' }, agora, lerDb().permissoes)).toBe(false)
  })
})

describe('Vendas', () => {
  it('Corretor não registra nem exporta; Gerente faz os dois', () => {
    const { unmount } = renderizar('/vendas', { usuarioId: CORRETOR })
    expect(link('Registrar venda')).not.toBeInTheDocument()
    expect(botao('Exportar CSV')).not.toBeInTheDocument()
    unmount()
    renderizar('/vendas', { usuarioId: GERENTE })
    expect(link('Registrar venda')).toBeInTheDocument()
    expect(botao('Exportar CSV')).toBeInTheDocument()
  })
})

describe('Dashboard', () => {
  it('atalho "Novo imóvel" só para quem cadastra imóveis', () => {
    const { unmount } = renderizar('/dashboard', { usuarioId: COLETOR })
    expect(botao('Novo imóvel')).toBeInTheDocument()
    unmount()
    renderizar('/dashboard', { usuarioId: CORRETOR })
    expect(botao('Novo imóvel')).not.toBeInTheDocument()
  })
})

describe('Administrador', () => {
  it('mantém todas as ações', () => {
    renderizar('/vendas', { usuarioId: ADMIN })
    expect(link('Registrar venda')).toBeInTheDocument()
    expect(within(menu()).getByRole('link', { name: 'Relatórios' })).toBeInTheDocument()
  })
})
