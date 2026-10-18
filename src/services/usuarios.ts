import { atualizarDb, lerDb } from '../data/db'
import type { Db, MatrizPermissoes, Perfil, Usuario } from '../data/types'
import { diferencasMatriz, normalizarMatriz, pode, type MudancaPermissao } from '../lib/permissoes'
import { impedimentoAlterarPerfil, impedimentoInativar, validarCadastroUsuario, validarConvite, type FormConvite } from '../lib/usuarios'
import { esperar, novoId } from './api'

/**
 * Serviço de usuários e permissões. Grava no banco local como o restante de
 * `services/api.ts`; com o backend, só o corpo destas funções muda. As regras
 * são checadas aqui também, e não só na tela, como o backend terá de fazer.
 */

/** Quem executa a ação: o perfil é relido do cadastro, nunca confiado à sessão. */
function exigirAdministrador(db: Db, executorId: string) {
  const executor = db.usuarios.find((u) => u.id === executorId)
  if (!executor?.ativo || !pode(executor, 'gerenciar_usuarios', db.permissoes)) {
    throw new Error('Seu perfil não tem permissão para gerenciar usuários.')
  }
}

function acharUsuario(db: Db, id: string) {
  const usuario = db.usuarios.find((u) => u.id === id)
  if (!usuario) throw new Error('Usuário não encontrado.')
  return usuario
}

function comUsuario(db: Db, id: string, alteracoes: Partial<Usuario>): Db {
  return { ...db, usuarios: db.usuarios.map((u) => (u.id === id ? { ...u, ...alteracoes } : u)) }
}

/** Cria o usuário sem senha: ele só consegue entrar depois de defini-la pelo convite. */
export async function convidarUsuario(form: FormConvite, executorId: string) {
  await esperar()
  let criado!: Usuario
  atualizarDb((db) => {
    exigirAdministrador(db, executorId)
    const erros = validarConvite(
      form,
      db.usuarios.map((u) => u.email),
    )
    const primeiro = Object.values(erros)[0]
    if (primeiro) throw new Error(primeiro)
    criado = {
      id: novoId('usr'),
      nome: form.nome.trim(),
      email: form.email.trim().toLowerCase(),
      senha: '',
      papel: form.papel as Perfil,
      ativo: true,
      ultimoAcesso: null,
    }
    return { ...db, usuarios: [...db.usuarios, criado] }
  })
  return criado
}

export async function alterarPerfil(id: string, papel: Perfil, executorId: string) {
  await esperar()
  atualizarDb((db) => {
    exigirAdministrador(db, executorId)
    const alvo = acharUsuario(db, id)
    const impedimento = impedimentoAlterarPerfil(alvo, papel, executorId, db.usuarios)
    if (impedimento) throw new Error(impedimento)
    return comUsuario(db, id, { papel })
  })
}

/** Inativar bloqueia novos logins e encerra a sessão aberta; reservas, propostas e vendas continuam como estão. */
export async function alterarStatusUsuario(id: string, ativo: boolean, executorId: string) {
  await esperar()
  atualizarDb((db) => {
    exigirAdministrador(db, executorId)
    const alvo = acharUsuario(db, id)
    if (!ativo) {
      const impedimento = impedimentoInativar(alvo, executorId, db.usuarios)
      if (impedimento) throw new Error(impedimento)
    }
    return comUsuario(db, id, { ativo })
  })
}

export interface DadosCadastroUsuario {
  nome: string
  papel: Perfil
  ativo: boolean
}

/** Edição pelo cadastro do usuário. O e-mail não muda: é o login. */
export async function atualizarUsuario(id: string, dados: DadosCadastroUsuario, executorId: string) {
  await esperar()
  atualizarDb((db) => {
    exigirAdministrador(db, executorId)
    const alvo = acharUsuario(db, id)
    const erro = validarCadastroUsuario(dados).nome
    if (erro) throw new Error(erro)
    if (dados.papel !== alvo.papel) {
      const impedimento = impedimentoAlterarPerfil(alvo, dados.papel, executorId, db.usuarios)
      if (impedimento) throw new Error(impedimento)
    }
    if (alvo.ativo && !dados.ativo) {
      const impedimento = impedimentoInativar(alvo, executorId, db.usuarios)
      if (impedimento) throw new Error(impedimento)
    }
    return comUsuario(db, id, { nome: dados.nome.trim(), papel: dados.papel, ativo: dados.ativo })
  })
}

/**
 * Salva a matriz editada na tela. As células travadas são reaplicadas aqui, e
 * cada gravação entra na auditoria com autor, data e o que mudou.
 */
export async function salvarPermissoes(matriz: MatrizPermissoes, executorId: string) {
  await esperar()
  let mudancas: MudancaPermissao[] = []
  atualizarDb((db) => {
    exigirAdministrador(db, executorId)
    const nova = normalizarMatriz(matriz)
    mudancas = diferencasMatriz(db.permissoes, nova)
    if (mudancas.length === 0) throw new Error('Nenhuma permissão foi alterada.')
    const autor = acharUsuario(db, executorId)
    return {
      ...db,
      permissoes: nova,
      alteracoesPermissoes: [
        ...db.alteracoesPermissoes,
        { id: novoId('perm'), data: new Date().toISOString(), autorId: autor.id, autor: autor.nome, mudancas },
      ],
    }
  })
  return mudancas
}

/** Sem servidor de e-mail ainda: só confirma para quem o link seria enviado. */
export async function redefinirSenha(id: string, executorId: string) {
  await esperar()
  const db = lerDb()
  exigirAdministrador(db, executorId)
  return { email: acharUsuario(db, id).email }
}
