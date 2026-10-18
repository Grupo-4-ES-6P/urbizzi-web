import { lerDb } from '../data/db'
import { matrizPadrao } from '../lib/permissoes'
import { autenticar } from './api'
import { alterarPerfil, alterarStatusUsuario, atualizarUsuario, convidarUsuario, redefinirSenha, salvarPermissoes } from './usuarios'
import { cancelarVenda } from './vendas'

const ADMIN = 'usr-1'
const GERENTE = 'usr-3'

const erroDe = async (promessa: Promise<unknown>) => {
  try {
    await promessa
  } catch (e) {
    return (e as Error).message
  }
  throw new Error('Era esperado um erro.')
}

const acharPorNome = (nome: string) => lerDb().usuarios.find((u) => u.nome === nome)!

describe('seed de usuários', () => {
  it('tem 17 ativos (3 admin, 2 gerentes, 8 corretores, 4 coletores) e uma inativa', () => {
    const usuarios = lerDb().usuarios
    const ativos = usuarios.filter((u) => u.ativo)
    expect(ativos).toHaveLength(17)
    expect(usuarios.filter((u) => !u.ativo).map((u) => u.nome)).toEqual(['Renata Foscarini'])
    const contar = (papel: string) => ativos.filter((u) => u.papel === papel).length
    expect([contar('Administrador'), contar('Gerente comercial'), contar('Corretor'), contar('Coletor')]).toEqual([3, 2, 8, 4])
  })

  it('todo responsável de reserva, proposta e venda é um usuário', () => {
    const { usuarios, reservas, propostas, vendas } = lerDb()
    const ids = new Set(usuarios.map((u) => u.id))
    for (const r of [...reservas, ...propostas, ...vendas]) expect(ids.has(r.corretorId)).toBe(true)
  })
})

describe('login', () => {
  it('registra o sucesso e atualiza o último acesso', async () => {
    const antes = lerDb().acessos.length
    await autenticar('  AYRAN@urbizzi.com.br ', 'urbizzi123')
    const { acessos, usuarios } = lerDb()
    expect(acessos).toHaveLength(antes + 1)
    expect(acessos.at(-1)).toMatchObject({ usuarioId: 'usr-1', email: 'ayran@urbizzi.com.br', resultado: 'sucesso' })
    expect(usuarios.find((u) => u.id === 'usr-1')!.ultimoAcesso).toBe(acessos.at(-1)!.data)
  })

  it('recusa senha errada e e-mail desconhecido com a mesma mensagem, e registra as tentativas', async () => {
    expect(await erroDe(autenticar('ayran@urbizzi.com.br', 'errada'))).toBe('E-mail ou senha incorretos.')
    expect(await erroDe(autenticar('ninguem@urbizzi.com.br', 'urbizzi123'))).toBe('E-mail ou senha incorretos.')
    expect(
      lerDb()
        .acessos.slice(-2)
        .map((a) => [a.usuarioId, a.resultado]),
    ).toEqual([
      ['usr-1', 'senha_incorreta'],
      [null, 'senha_incorreta'],
    ])
  })

  it('bloqueia usuário inativo mesmo com a senha certa', async () => {
    const renata = acharPorNome('Renata Foscarini')
    expect(await erroDe(autenticar(renata.email, 'urbizzi123'))).toBe('Seu acesso está inativo. Procure um administrador.')
    expect(lerDb().acessos.at(-1)).toMatchObject({ usuarioId: renata.id, resultado: 'usuario_inativo' })
    expect(acharPorNome('Renata Foscarini').ultimoAcesso).toBe(renata.ultimoAcesso)
  })
})

describe('gestão de usuários', () => {
  it('convida sem senha: o convidado aparece ativo, mas não consegue entrar', async () => {
    const criado = await convidarUsuario({ nome: ' Ana Souza ', email: 'ANA@urbizzi.com.br', papel: 'Corretor' }, ADMIN)
    expect(criado).toMatchObject({
      nome: 'Ana Souza',
      email: 'ana@urbizzi.com.br',
      papel: 'Corretor',
      ativo: true,
      ultimoAcesso: null,
      senha: '',
    })
    expect(lerDb().usuarios).toContainEqual(criado)
    expect(await erroDe(autenticar('ana@urbizzi.com.br', ''))).toBe('E-mail ou senha incorretos.')
  })

  it('recusa convite com e-mail repetido', async () => {
    expect(await erroDe(convidarUsuario({ nome: 'Outro', email: 'arthur@urbizzi.com.br', papel: 'Corretor' }, ADMIN))).toBe(
      'Já existe um usuário com este e-mail.',
    )
  })

  it('só o Administrador gerencia usuários, mesmo chamando o serviço direto', async () => {
    const matheus = acharPorNome('Matheus Oening')
    const negado = 'Seu perfil não tem permissão para gerenciar usuários.'
    expect(await erroDe(convidarUsuario({ nome: 'Ana Souza', email: 'ana@urbizzi.com.br', papel: 'Corretor' }, GERENTE))).toBe(negado)
    expect(await erroDe(alterarPerfil(matheus.id, 'Gerente comercial', GERENTE))).toBe(negado)
    expect(await erroDe(alterarStatusUsuario(matheus.id, false, GERENTE))).toBe(negado)
    expect(await erroDe(redefinirSenha(matheus.id, GERENTE))).toBe(negado)
    expect(acharPorNome('Matheus Oening')).toEqual(matheus)
  })

  it('altera perfil, inativa e reativa', async () => {
    const matheus = acharPorNome('Matheus Oening')
    await alterarPerfil(matheus.id, 'Gerente comercial', ADMIN)
    expect(acharPorNome('Matheus Oening').papel).toBe('Gerente comercial')
    await alterarStatusUsuario(matheus.id, false, ADMIN)
    expect(acharPorNome('Matheus Oening').ativo).toBe(false)
    await alterarStatusUsuario(matheus.id, true, ADMIN)
    expect(acharPorNome('Matheus Oening').ativo).toBe(true)
  })

  it('o administrador não inativa nem rebaixa a si mesmo', async () => {
    expect(await erroDe(alterarStatusUsuario(ADMIN, false, ADMIN))).toBe('Você não pode inativar o próprio usuário.')
    expect(await erroDe(alterarPerfil(ADMIN, 'Corretor', ADMIN))).toBe('Você não pode alterar o próprio perfil.')
  })

  it('administrador inativado perde a permissão na hora', async () => {
    const fernanda = acharPorNome('Fernanda Rocha')
    await alterarStatusUsuario(fernanda.id, false, ADMIN)
    expect(await erroDe(alterarStatusUsuario('usr-4', false, fernanda.id))).toBe('Seu perfil não tem permissão para gerenciar usuários.')
  })

  it('redefinir senha só confirma o e-mail de destino', async () => {
    const antes = lerDb()
    expect(await redefinirSenha('usr-4', ADMIN)).toEqual({ email: 'joao@urbizzi.com.br' })
    expect(lerDb()).toBe(antes)
  })
})

describe('cadastro do usuário', () => {
  it('atualiza nome, perfil e status; o e-mail não muda', async () => {
    const joao = acharPorNome('João Victor Billó')
    await atualizarUsuario(joao.id, { nome: '  João Billó  ', papel: 'Gerente comercial', ativo: false }, ADMIN)
    const salvo = lerDb().usuarios.find((u) => u.id === joao.id)!
    expect(salvo).toMatchObject({ nome: 'João Billó', papel: 'Gerente comercial', ativo: false, email: joao.email })
  })

  it('valida o nome e as mesmas regras do menu', async () => {
    expect(await erroDe(atualizarUsuario('usr-4', { nome: 'Jo', papel: 'Corretor', ativo: true }, ADMIN))).toBe('Informe o nome completo.')
    expect(await erroDe(atualizarUsuario(ADMIN, { nome: 'Ayran Bade', papel: 'Corretor', ativo: true }, ADMIN))).toBe(
      'Você não pode alterar o próprio perfil.',
    )
    expect(await erroDe(atualizarUsuario(ADMIN, { nome: 'Ayran Bade', papel: 'Administrador', ativo: false }, ADMIN))).toBe(
      'Você não pode inativar o próprio usuário.',
    )
    // Mudar só o nome do próprio usuário é permitido.
    await atualizarUsuario(ADMIN, { nome: 'Ayran B. Bade', papel: 'Administrador', ativo: true }, ADMIN)
    expect(lerDb().usuarios.find((u) => u.id === ADMIN)!.nome).toBe('Ayran B. Bade')
  })

  it('só o Administrador edita o cadastro', async () => {
    expect(await erroDe(atualizarUsuario('usr-4', { nome: 'Outro Nome', papel: 'Corretor', ativo: true }, GERENTE))).toBe(
      'Seu perfil não tem permissão para gerenciar usuários.',
    )
  })
})

describe('matriz de permissões salva', () => {
  it('nasce com a matriz padrão', () => {
    expect(lerDb().permissoes).toEqual(matrizPadrao())
    expect(lerDb().alteracoesPermissoes).toEqual([])
  })

  it('grava as mudanças com auditoria e passa a valer nas verificações', async () => {
    const nova = { ...matrizPadrao(), cancelar_venda: ['Administrador' as const, 'Gerente comercial' as const] }
    const mudancas = await salvarPermissoes(nova, ADMIN)
    expect(mudancas).toEqual([{ permissao: 'cancelar_venda', perfil: 'Gerente comercial', concedida: true }])
    expect(lerDb().permissoes.cancelar_venda).toEqual(['Administrador', 'Gerente comercial'])
    expect(lerDb().alteracoesPermissoes).toEqual([expect.objectContaining({ autorId: ADMIN, autor: 'Ayran Bade', mudancas })])
    // A verificação do serviço de vendas usa a matriz salva.
    const venda = lerDb().vendas.find((v) => v.status === 'concluida')!
    await cancelarVenda(
      venda.id,
      { justificativa: 'Distrato assinado pelas partes.' },
      { nome: 'Gabriela Krüger', papel: 'Gerente comercial' },
    )
    expect(lerDb().vendas.find((v) => v.id === venda.id)!.status).toBe('cancelada')
  })

  it('mantém o Administrador na gestão de usuários mesmo se a matriz vier sem ele', async () => {
    const semAdmin = { ...matrizPadrao(), gerenciar_usuarios: [], emitir_relatorios: ['Administrador' as const] }
    const mudancas = await salvarPermissoes(semAdmin, ADMIN)
    expect(mudancas).toEqual([{ permissao: 'emitir_relatorios', perfil: 'Gerente comercial', concedida: false }])
    expect(lerDb().permissoes.gerenciar_usuarios).toEqual(['Administrador'])
  })

  it('recusa salvar sem mudanças ou por quem não administra', async () => {
    expect(await erroDe(salvarPermissoes(matrizPadrao(), ADMIN))).toBe('Nenhuma permissão foi alterada.')
    expect(await erroDe(salvarPermissoes({ ...matrizPadrao(), cancelar_venda: [] }, GERENTE))).toBe(
      'Seu perfil não tem permissão para gerenciar usuários.',
    )
  })
})
