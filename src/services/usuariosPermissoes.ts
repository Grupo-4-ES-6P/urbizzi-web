import { PERFIL_NA_API, PERFIS, perfilDaApi, type Perfil } from '../data/permissoes'
import type { UsuarioPublico } from '../data/types'
import { ErroApi, http } from './http'

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

export type MatrizPermissoes = Record<string, Perfil[]>

interface UsuarioApi {
  id: string
  name: string
  email: string
  status: string
  perfil: string
  ultimoAcesso: string | null
}

interface MatrizApi {
  matriz: Record<string, string[]>
}

function paraUsuario(u: UsuarioApi): UsuarioPublico {
  return {
    id: u.id,
    nome: u.name,
    email: u.email,
    papel: perfilDaApi(u.perfil),
    ativo: u.status === 'ATIVO',
    ultimoAcesso: u.ultimoAcesso ?? undefined,
  }
}

function paraMatriz({ matriz }: MatrizApi): MatrizPermissoes {
  return Object.fromEntries(
    Object.entries(matriz).map(([permissao, perfis]) => [permissao.toLowerCase(), perfis.map(perfilDaApi)]),
  )
}

export function validarUsuario(form: FormUsuario, id: string | undefined, usuarios: UsuarioPublico[]): ErrosUsuario {
  const erros: ErrosUsuario = {}
  if (form.nome.trim().split(/\s+/).length < 2) erros.nome = 'Informe nome e sobrenome.'
  const email = form.email.trim().toLowerCase()
  if (!EMAIL.test(email)) erros.email = 'E-mail inválido.'
  else if (usuarios.some((u) => u.id !== id && u.email.toLowerCase() === email)) erros.email = 'Já existe um usuário com este e-mail.'
  if (!PERFIS.includes(form.papel)) erros.papel = 'Escolha um perfil.'
  if ((!id || form.senha) && form.senha.length < 8) erros.senha = 'A senha precisa ter pelo menos 8 caracteres.'
  return erros
}

export async function listarUsuarios(signal?: AbortSignal) {
  const usuarios = await http<UsuarioApi[]>('/users', { signal })
  return usuarios.map(paraUsuario)
}

export async function salvarUsuario(form: FormUsuario, id?: string) {
  const dados = {
    name: form.nome.trim(),
    email: form.email.trim().toLowerCase(),
    perfil: PERFIL_NA_API[form.papel],
    status: form.ativo ? 'ATIVO' : 'INATIVO',
    ...(form.senha ? { password: form.senha } : {}),
  }
  try {
    const salvo = id
      ? await http<UsuarioApi>(`/users/${id}`, { method: 'PUT', body: dados })
      : await http<UsuarioApi>('/users', { method: 'POST', body: dados })
    return salvo.id
  } catch (error_) {
    if (error_ instanceof ErroApi && error_.status === 409) throw new Error('Já existe um usuário com este e-mail.')
    throw error_
  }
}

export async function obterMatriz(signal?: AbortSignal) {
  return paraMatriz(await http<MatrizApi>('/permissoes', { signal }))
}

export async function alterarPermissao(permissao: string, perfil: Perfil, liberado: boolean) {
  const resposta = await http<MatrizApi>('/permissoes', {
    method: 'PUT',
    body: { permissao: permissao.toUpperCase(), perfil: PERFIL_NA_API[perfil], liberado },
  })
  return paraMatriz(resposta)
}
