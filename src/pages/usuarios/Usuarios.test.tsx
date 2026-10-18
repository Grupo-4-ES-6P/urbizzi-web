import { screen, within } from '@testing-library/react'

import { lerDb, restaurarDemo } from '../../data/db'
import { renderizar } from '../../test/utils'

const tabelaUsuarios = () => within(screen.getByRole('region', { name: 'Usuários' })).getByRole('table')
const linhas = () => within(tabelaUsuarios()).getAllByRole('row').slice(1)
const linhaDe = (nome: string) => linhas().find((l) => within(l).queryByText(nome))!
const nomes = () => linhas().map((l) => l.querySelector('.tabela__destaque')!.textContent)
const dialogo = () => screen.getByRole('dialog')
const menu = () => screen.getByRole('menu')

beforeEach(() => {
  // Só o relógio é falso: o "último acesso" do seed é relativo a agora.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 12, 10))
  restaurarDemo()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Usuários e permissões', () => {
  it('mostra o resumo, os perfis, a lista e a matriz do protótipo', () => {
    renderizar('/usuarios')

    expect(screen.getByRole('heading', { name: 'Usuários e permissões' })).toBeInTheDocument()
    expect(screen.getByText('17 usuários ativos · senhas armazenadas com hash seguro')).toBeInTheDocument()

    const cards = within(screen.getByRole('group', { name: 'Usuários ativos por perfil' })).getAllByRole('button')
    expect(cards.map((c) => c.textContent)).toEqual([
      'Administrador3Acesso total ao sistema',
      'Gerente comercial2Aprova propostas e descontos',
      'Corretor8Cria reservas e propostas',
      'Coletor4Cadastra imóveis em campo',
    ])

    expect(
      within(tabelaUsuarios())
        .getAllByRole('columnheader')
        .map((c) => c.textContent),
    ).toEqual(['Usuário', 'E-mail', 'Perfil', 'Último acesso', 'Status', 'Ações'])
    expect(nomes()).toEqual([
      'Ayran Bade',
      'Fernanda Rocha',
      'Paulo Henrique Dias',
      'Arthur Pacheco',
      'Gabriela Krüger',
      'Camila Teixeira',
      'Diego Krüger',
      'Guilherme Lima',
      'João Victor Billó',
      'Larissa Mendes',
      'Leonardo Albuquerque',
      'Matheus Oening',
      'Rafael Bortolini',
      'Gustavo M. Lima',
      'Juliana Bertoldi',
      'Thiago Moreira',
      'Vinícius Araújo',
      'Renata Foscarini',
    ])
    const celulas = (nome: string) =>
      within(linhaDe(nome))
        .getAllByRole('cell')
        .slice(1, 5)
        .map((c) => c.textContent)
    expect(celulas('Ayran Bade')).toEqual(['ayran@urbizzi.com.br', 'Administrador', 'Agora', 'Ativo'])
    expect(celulas('Arthur Pacheco')).toEqual(['arthur@urbizzi.com.br', 'Gerente comercial', 'Hoje · 08:41', 'Ativo'])
    expect(celulas('Gabriela Krüger')).toEqual(['gabriela@urbizzi.com.br', 'Gerente comercial', 'Ontem · 17:22', 'Ativo'])
    expect(celulas('Gustavo M. Lima')).toEqual(['gustavo@urbizzi.com.br', 'Coletor', '3 dias atrás', 'Ativo'])
    expect(celulas('Renata Foscarini')).toEqual(['renata@urbizzi.com.br', 'Corretor', '18 dias atrás', 'Inativo'])
    expect(celulas('Vinícius Araújo')[2]).toBe('Nunca acessou')
    expect(within(linhaDe('Ayran Bade')).getByText('você')).toBeInTheDocument()

    const regiaoMatriz = screen.getByRole('region', { name: 'Matriz de permissões' })
    expect(within(regiaoMatriz).getAllByRole('row')).toHaveLength(14)
    const ultima = within(regiaoMatriz).getAllByRole('row').at(-1)!
    const gerenciarAdmin = within(ultima).getByRole('checkbox', { name: 'Administrador: Gerenciar usuários e permissões' })
    expect(gerenciarAdmin).toBeChecked()
    expect(gerenciarAdmin).toBeDisabled()
    expect(within(ultima).getByRole('checkbox', { name: 'Gerente comercial: Gerenciar usuários e permissões' })).not.toBeChecked()
  })

  it('o card do perfil filtra a lista e pode ser desmarcado', async () => {
    const { user } = renderizar('/usuarios')
    const coletor = screen.getByRole('button', { name: /^Coletor/ })

    await user.click(coletor)
    expect(coletor).toHaveAttribute('aria-pressed', 'true')
    expect(nomes()).toEqual(['Gustavo M. Lima', 'Juliana Bertoldi', 'Thiago Moreira', 'Vinícius Araújo'])
    expect(screen.getByLabelText('Perfil')).toHaveDisplayValue('Coletor')

    await user.click(coletor)
    expect(coletor).toHaveAttribute('aria-pressed', 'false')
    expect(linhas()).toHaveLength(18)
  })

  it('busca ignorando acentos, filtra por status e mostra o estado vazio', async () => {
    const { user } = renderizar('/usuarios')
    const busca = screen.getByRole('searchbox', { name: 'Buscar usuários' })

    await user.type(busca, 'kruger')
    expect(nomes()).toEqual(['Gabriela Krüger', 'Diego Krüger'])

    await user.clear(busca)
    await user.selectOptions(screen.getByLabelText('Status'), 'Inativos')
    expect(nomes()).toEqual(['Renata Foscarini'])

    await user.type(busca, 'ninguém')
    expect(screen.getByText('Nenhum usuário encontrado com esses filtros.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Limpar filtros' }))
    expect(linhas()).toHaveLength(18)
  })

  it('o próprio usuário não tem as ações de perfil e de inativação', async () => {
    const { user } = renderizar('/usuarios')
    await user.click(screen.getByRole('button', { name: 'Ações de Ayran Bade' }))
    expect(
      within(menu())
        .getAllByRole('menuitem')
        .map((i) => i.textContent),
    ).toEqual(['Editar cadastro', 'Redefinir senha'])

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Ações de Renata Foscarini' }))
    expect(
      within(menu())
        .getAllByRole('menuitem')
        .map((i) => i.textContent),
    ).toEqual(['Editar cadastro', 'Reativar'])
  })

  it('inativa e reativa com confirmação', async () => {
    const { user } = renderizar('/usuarios')

    await user.click(screen.getByRole('button', { name: 'Ações de Matheus Oening' }))
    expect(
      within(menu())
        .getAllByRole('menuitem')
        .map((i) => i.textContent),
    ).toEqual(['Editar cadastro', 'Alterar perfil', 'Redefinir senha', 'Inativar'])
    await user.click(within(menu()).getByRole('menuitem', { name: 'Inativar' }))
    expect(within(dialogo()).getByRole('heading', { name: 'Inativar Matheus Oening?' })).toBeInTheDocument()
    await user.click(within(dialogo()).getByRole('button', { name: 'Inativar' }))

    expect(await screen.findByText('Matheus Oening foi inativado.')).toBeInTheDocument()
    expect(within(linhaDe('Matheus Oening')).getByText('Inativo')).toBeInTheDocument()
    expect(screen.getByText('16 usuários ativos · senhas armazenadas com hash seguro')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Corretor/ })).toHaveTextContent('Corretor7')

    await user.click(screen.getByRole('button', { name: 'Ações de Matheus Oening' }))
    await user.click(within(menu()).getByRole('menuitem', { name: 'Reativar' }))
    await user.click(within(dialogo()).getByRole('button', { name: 'Reativar' }))
    expect(await screen.findByText('Matheus Oening foi reativado.')).toBeInTheDocument()
    expect(lerDb().usuarios.find((u) => u.nome === 'Matheus Oening')!.ativo).toBe(true)
  })

  it('altera o perfil pelo menu', async () => {
    const { user } = renderizar('/usuarios')
    await user.click(screen.getByRole('button', { name: 'Ações de João Victor Billó' }))
    await user.click(within(menu()).getByRole('menuitem', { name: 'Alterar perfil' }))

    const perfil = within(dialogo()).getByLabelText('Perfil')
    expect(perfil).toHaveDisplayValue('Corretor — cria reservas e propostas')
    await user.selectOptions(perfil, 'Gerente comercial')
    await user.click(within(dialogo()).getByRole('button', { name: 'Salvar perfil' }))

    expect(await screen.findByText('João Victor Billó agora é Gerente comercial.')).toBeInTheDocument()
    expect(within(linhaDe('João Victor Billó')).getByText('Gerente comercial')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Gerente comercial/ })).toHaveTextContent('Gerente comercial3')
  })

  it('redefine a senha enviando o link por e-mail', async () => {
    const { user } = renderizar('/usuarios')
    await user.click(screen.getByRole('button', { name: 'Ações de Arthur Pacheco' }))
    await user.click(within(menu()).getByRole('menuitem', { name: 'Redefinir senha' }))
    await user.click(within(dialogo()).getByRole('button', { name: 'Enviar link' }))
    expect(await screen.findByText('Link de redefinição de senha enviado para arthur@urbizzi.com.br.')).toBeInTheDocument()
  })

  it('convida um usuário validando os campos', async () => {
    const { user } = renderizar('/usuarios')
    await user.click(screen.getByRole('button', { name: 'Convidar usuário' }))

    await user.click(within(dialogo()).getByRole('button', { name: 'Enviar convite' }))
    expect(within(dialogo()).getByText('Informe o nome completo.')).toBeInTheDocument()
    expect(within(dialogo()).getByText('Informe o e-mail.')).toBeInTheDocument()
    expect(within(dialogo()).getByText('Selecione o perfil.')).toBeInTheDocument()

    await user.type(within(dialogo()).getByLabelText('Nome completo'), 'Ana Souza')
    await user.type(within(dialogo()).getByLabelText('E-mail'), 'renata@urbizzi.com.br')
    expect(within(dialogo()).getByText('Já existe um usuário com este e-mail.')).toBeInTheDocument()
    await user.clear(within(dialogo()).getByLabelText('E-mail'))
    await user.type(within(dialogo()).getByLabelText('E-mail'), 'ana@urbizzi.com.br')
    await user.selectOptions(within(dialogo()).getByLabelText('Perfil'), 'Coletor — cadastra imóveis em campo')
    await user.click(within(dialogo()).getByRole('button', { name: 'Enviar convite' }))

    expect(await screen.findByText('Convite enviado para ana@urbizzi.com.br.')).toBeInTheDocument()
    const celulas = within(linhaDe('Ana Souza'))
      .getAllByRole('cell')
      .map((c) => c.textContent)
    expect(celulas.slice(1, 5)).toEqual(['ana@urbizzi.com.br', 'Coletor', 'Nunca acessou', 'Ativo'])
    expect(screen.getByText('18 usuários ativos · senhas armazenadas com hash seguro')).toBeInTheDocument()
  })
})

describe('acesso ao módulo', () => {
  it('o Administrador vê o item Usuários na sidebar, ativo na rota', () => {
    renderizar('/usuarios')
    const link = within(screen.getByRole('complementary', { name: 'Menu principal' })).getByRole('link', { name: 'Usuários' })
    expect(link).toHaveClass('active')
  })

  it.each([
    ['Gerente comercial', 'usr-3'],
    ['Corretor', 'usr-4'],
    ['Coletor', 'usr-6'],
  ])('%s não vê o módulo: sem item no menu e a rota volta ao dashboard', (_perfil, usuarioId) => {
    renderizar('/usuarios', { usuarioId })
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Usuários' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Usuários e permissões/)).not.toBeInTheDocument()
  })

  it('o log de acessos também é restrito', () => {
    renderizar('/usuarios/acessos', { usuarioId: 'usr-3' })
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
  })

  it('a sessão de um usuário inativo é encerrada', () => {
    const renata = lerDb().usuarios.find((u) => u.nome === 'Renata Foscarini')!
    renderizar('/dashboard', { usuarioId: renata.id })
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument()
  })
})

describe('Log de acessos', () => {
  it('lista as tentativas da mais recente para a mais antiga e filtra por resultado', async () => {
    const { user } = renderizar('/usuarios')
    await user.click(screen.getByRole('link', { name: 'Log de acessos' }))

    expect(screen.getByRole('heading', { name: 'Log de acessos' })).toBeInTheDocument()
    expect(screen.getByText('20 tentativas de login registradas · 3 recusadas')).toBeInTheDocument()
    const linhasLog = () => within(screen.getByRole('table')).getAllByRole('row').slice(1)
    expect(linhasLog()[0]).toHaveTextContent('Ayran Bade')
    const datas = linhasLog().map((l) => l.querySelector('time')!.getAttribute('datetime')!)
    expect(datas).toEqual([...datas].sort().reverse())

    await user.selectOptions(screen.getByLabelText('Resultado'), 'Senha incorreta')
    expect(linhasLog().map((l) => within(l).getAllByRole('cell')[1].textContent)).toEqual(['Gabriela Krüger', 'E-mail não cadastrado'])

    await user.selectOptions(screen.getByLabelText('Resultado'), 'Usuário inativo')
    expect(linhasLog()).toHaveLength(1)
    expect(linhasLog()[0]).toHaveTextContent('Renata Foscarini')
  })
})

describe('Cadastro do usuário', () => {
  it('abre pela linha da lista e edita nome, perfil e status', async () => {
    const { user } = renderizar('/usuarios')
    await user.click(screen.getByRole('link', { name: 'Gustavo M. Lima' }))

    expect(screen.getByRole('heading', { level: 1, name: 'Gustavo M. Lima' })).toBeInTheDocument()
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('readonly')
    expect(screen.getByRole('heading', { name: 'O que o perfil Coletor pode fazer' })).toBeInTheDocument()
    expect(screen.getByText('Cadastrar e editar imóveis')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Acessos' })).getAllByRole('row')).toHaveLength(2)
    const salvar = screen.getByRole('button', { name: 'Salvar alterações' })
    expect(salvar).toBeDisabled()

    await user.clear(screen.getByLabelText('Nome completo'))
    await user.click(salvar)
    expect(screen.getByText('Informe o nome completo.')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Nome completo'), 'Gustavo Moraes Lima')
    await user.selectOptions(screen.getByLabelText('Perfil'), 'Corretor')
    expect(screen.getByRole('heading', { name: 'O que o perfil Corretor pode fazer' })).toBeInTheDocument()
    await user.click(screen.getByRole('switch', { name: 'Usuário ativo' }))
    await user.click(salvar)

    expect(await screen.findByText('Cadastro do usuário atualizado.')).toBeInTheDocument()
    expect(lerDb().usuarios.find((u) => u.id === 'usr-6')).toMatchObject({ nome: 'Gustavo Moraes Lima', papel: 'Corretor', ativo: false })
    expect(screen.getByRole('heading', { level: 1, name: 'Gustavo Moraes Lima' })).toBeInTheDocument()
  })

  it('no próprio cadastro, perfil e status ficam travados com o motivo', () => {
    renderizar('/usuarios/usr-1')
    expect(screen.getByLabelText('Perfil')).toBeDisabled()
    expect(screen.getByText('Você não pode alterar o próprio perfil.')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Usuário ativo' })).toBeDisabled()
    expect(screen.getByText('Você não pode inativar o próprio usuário.')).toBeInTheDocument()
    expect(screen.getByLabelText('Nome completo')).toBeEnabled()
  })

  it('mostra o convite pendente e trata usuário inexistente', () => {
    const { unmount } = renderizar('/usuarios/nao-existe')
    expect(screen.getByRole('heading', { name: 'Usuário não encontrado' })).toBeInTheDocument()
    unmount()
    renderizar('/usuarios/usr-18')
    expect(screen.getByText(/Nunca acessou/)).toBeInTheDocument()
    expect(screen.getByText('Nenhuma tentativa de login registrada para este usuário.')).toBeInTheDocument()
  })

  it('é restrito ao Administrador', () => {
    renderizar('/usuarios/usr-4', { usuarioId: 'usr-3' })
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
  })
})

describe('Matriz editável', () => {
  const celula = (nome: string) => screen.getByRole('checkbox', { name: nome })

  it('salva com confirmação, registra o autor e vale na hora para o perfil', async () => {
    const { user, unmount } = renderizar('/usuarios')
    expect(screen.queryByRole('button', { name: /Salvar permissões/ })).not.toBeInTheDocument()

    await user.click(celula('Corretor: Registrar venda'))
    await user.click(celula('Gerente comercial: Emitir relatórios e exportar dados'))
    await user.click(screen.getByRole('button', { name: 'Salvar permissões (2)' }))
    expect(
      within(dialogo())
        .getAllByRole('listitem')
        .map((i) => i.textContent),
    ).toEqual(['Concede Corretor: Registrar venda', 'Remove Gerente comercial: Emitir relatórios e exportar dados'])
    await user.click(within(dialogo()).getByRole('button', { name: 'Salvar permissões' }))

    expect(await screen.findByText('Permissões salvas: 2 alterações.')).toBeInTheDocument()
    expect(screen.getByText(/última alteração em 12\/10\/2026, 10:00 por Ayran Bade/)).toBeInTheDocument()
    expect(celula('Corretor: Registrar venda')).toBeChecked()
    unmount()

    // O corretor passa a registrar vendas; o gerente perde a exportação.
    const corretor = renderizar('/vendas', { usuarioId: 'usr-4' })
    expect(screen.getByRole('link', { name: 'Registrar venda' })).toBeInTheDocument()
    corretor.unmount()
    renderizar('/vendas', { usuarioId: 'usr-2' })
    expect(screen.queryByRole('button', { name: 'Exportar CSV' })).not.toBeInTheDocument()
  })

  it('descartar volta à matriz salva; a gestão de usuários do Admin é travada', async () => {
    const { user } = renderizar('/usuarios')
    expect(celula('Administrador: Gerenciar usuários e permissões')).toBeDisabled()

    await user.click(celula('Coletor: Publicar imóvel no catálogo público'))
    expect(celula('Coletor: Publicar imóvel no catálogo público')).toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Descartar' }))
    expect(celula('Coletor: Publicar imóvel no catálogo público')).not.toBeChecked()
    expect(lerDb().alteracoesPermissoes).toHaveLength(0)
  })
})
