import { atualizarDb, lerDb } from '../data/db'
import { PERFIS, PERMISSAO_TRAVADA, PERMISSOES_PADRAO, type Perfil } from '../data/permissoes'
import type { Db, Usuario } from '../data/types'
import { esperar, novoId } from './api'

// Partes separadas por pontos sem sobreposição: evita retrocesso exponencial na regex.
const EMAIL = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/

export interface FormUsuario {
  nome: string
  email: string
  papel: Perfil
  ativo: boolean
  /** Obrigatória no cadastro; na edição, vazia mantém a senha atual. */
  senha: string
}

export type ErrosUsuario = Partial<Record<keyof FormUsuario, string>>

export function validarUsuario(form: FormUsuario, id: string | undefined, usuarios: Usuario[]): ErrosUsuario {
  const erros: ErrosUsuario = {}
  if (form.nome.trim().split(/\s+/).length < 2) erros.nome = 'Informe nome e sobrenome.'
  const email = form.email.trim().toLowerCase()
  if (!EMAIL.test(email)) erros.email = 'E-mail inválido.'
  else if (usuarios.some((u) => u.id !== id && u.email.toLowerCase() === email)) erros.email = 'Já existe um usuário com este e-mail.'
  if (!PERFIS.includes(form.papel)) erros.papel = 'Escolha um perfil.'
  if ((!id || form.senha) && form.senha.length < 8) erros.senha = 'A senha precisa ter pelo menos 8 caracteres.'
  return erros
}

/** Impede que o sistema fique sem nenhum administrador ativo. */
function restaAdministrador(db: Db, id: string | undefined, form: FormUsuario) {
  if (!id) return true
  return db.usuarios.some((u) =>
    u.id === id ? form.papel === 'Administrador' && form.ativo : u.papel === 'Administrador' && u.ativo !== false,
  )
}

export async function salvarUsuario(form: FormUsuario, id?: string) {
  await esperar()
  const erros = validarUsuario(form, id, lerDb().usuarios)
  const primeiro = Object.values(erros)[0]
  if (primeiro) throw new Error(primeiro)

  const salvoId = id ?? novoId('usr')
  atualizarDb((db) => {
    if (!restaAdministrador(db, id, form)) throw new Error('O sistema precisa de pelo menos um administrador ativo.')
    const dados = { nome: form.nome.trim(), email: form.email.trim().toLowerCase(), papel: form.papel, ativo: form.ativo }
    if (id) {
      return {
        ...db,
        usuarios: db.usuarios.map((u) => (u.id === id ? { ...u, ...dados, ...(form.senha ? { senha: form.senha } : {}) } : u)),
      }
    }
    return { ...db, usuarios: [...db.usuarios, { id: salvoId, ...dados, senha: form.senha }] }
  })
  return salvoId
}

export function matrizPermissoes(db: Db): Record<string, string[]> {
  return db.permissoes ?? PERMISSOES_PADRAO
}

export function alternarPermissao(permissao: string, perfil: Perfil) {
  if (permissao === PERMISSAO_TRAVADA && perfil === 'Administrador') {
    throw new Error('O administrador sempre gerencia usuários e permissões.')
  }
  atualizarDb((db) => {
    const atual = matrizPermissoes(db)
    const perfis = atual[permissao] ?? []
    const proximos = perfis.includes(perfil) ? perfis.filter((p) => p !== perfil) : [...perfis, perfil]
    return { ...db, permissoes: { ...atual, [permissao]: proximos } }
  })
}
