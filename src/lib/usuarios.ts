import type { MatrizPermissoes, Perfil, ResultadoAcesso, Usuario, VarianteBadge } from '../data/types'
import { EMAIL } from './clienteForm'
import { normalizar } from './format'
import { PERFIS, pode } from './permissoes'

// ===== Lista =====

const ORDEM_PERFIL = new Map(PERFIS.map((p, i) => [p.perfil, i]))

/** Ativos primeiro; depois por perfil (Administrador → Coletor) e por nome. */
export function ordenarUsuarios<T extends Pick<Usuario, 'nome' | 'papel' | 'ativo'>>(usuarios: readonly T[]): T[] {
  return [...usuarios].sort(
    (a, b) =>
      Number(b.ativo) - Number(a.ativo) ||
      (ORDEM_PERFIL.get(a.papel) ?? 99) - (ORDEM_PERFIL.get(b.papel) ?? 99) ||
      a.nome.localeCompare(b.nome, 'pt-BR'),
  )
}

export interface FiltrosUsuarios {
  q: string
  perfil: Perfil | ''
  status: 'ativo' | 'inativo' | ''
}

export function filtrarUsuarios<T extends Pick<Usuario, 'nome' | 'email' | 'papel' | 'ativo'>>(
  usuarios: readonly T[],
  f: FiltrosUsuarios,
): T[] {
  const termo = normalizar(f.q.trim())
  return usuarios.filter(
    (u) =>
      (!f.perfil || u.papel === f.perfil) &&
      (!f.status || (f.status === 'ativo') === u.ativo) &&
      (!termo || normalizar(`${u.nome} ${u.email}`).includes(termo)),
  )
}

export const ehPerfil = (valor: string): valor is Perfil => PERFIS.some((p) => p.perfil === valor)

/** Usuários ativos por perfil (cards do topo da tela). */
export function contarAtivosPorPerfil(usuarios: readonly Pick<Usuario, 'papel' | 'ativo'>[]) {
  const contagem = new Map<Perfil, number>(PERFIS.map((p) => [p.perfil, 0]))
  for (const u of usuarios) if (u.ativo) contagem.set(u.papel, (contagem.get(u.papel) ?? 0) + 1)
  return contagem
}

/** Quem pode ser responsável comercial de reservas e vendas: ativo e com permissão de registrar reserva. */
export function responsaveisComerciais<T extends Pick<Usuario, 'nome' | 'papel' | 'ativo'>>(
  usuarios: readonly T[],
  matriz: MatrizPermissoes,
): T[] {
  return usuarios.filter((u) => u.ativo && pode(u, 'registrar_reserva', matriz)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

// ===== Último acesso =====

const hora = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const inicioDoDia = (ms: number) => new Date(ms).setHours(0, 0, 0, 0)

/** "Agora" (até 5 min), "Hoje · 08:41", "Ontem · 17:22", "3 dias atrás" ou "Nunca acessou". */
export function formatarUltimoAcesso(iso: string | null, agoraMs: number) {
  if (!iso) return 'Nunca acessou'
  const data = new Date(iso)
  const ms = data.getTime()
  if (agoraMs - ms < 5 * 60_000) return 'Agora'
  // Arredonda para absorver a hora a mais/a menos do horário de verão.
  const dias = Math.round((inicioDoDia(agoraMs) - inicioDoDia(ms)) / 86_400_000)
  if (dias <= 0) return `Hoje · ${hora(data)}`
  if (dias === 1) return `Ontem · ${hora(data)}`
  return `${dias} dias atrás`
}

export const RESULTADO_ACESSO: Record<ResultadoAcesso, { rotulo: string; variante: VarianteBadge }> = {
  sucesso: { rotulo: 'Sucesso', variante: 'normal' },
  senha_incorreta: { rotulo: 'Senha incorreta', variante: 'critico' },
  usuario_inativo: { rotulo: 'Usuário inativo', variante: 'neutro' },
}

// ===== Regras de alteração =====

type Alvo = Pick<Usuario, 'id' | 'papel' | 'ativo'>

const outrosAdminsAtivos = (usuarios: readonly Alvo[], id: string) =>
  usuarios.some((u) => u.id !== id && u.ativo && u.papel === 'Administrador')

/** Motivo que impede inativar o usuário, ou `null` se pode. */
export function impedimentoInativar(alvo: Alvo, executorId: string, usuarios: readonly Alvo[]) {
  if (alvo.id === executorId) return 'Você não pode inativar o próprio usuário.'
  if (alvo.papel === 'Administrador' && alvo.ativo && !outrosAdminsAtivos(usuarios, alvo.id)) {
    return 'O sistema precisa de pelo menos um administrador ativo.'
  }
  return null
}

/** Motivo que impede trocar o perfil do usuário, ou `null` se pode. */
export function impedimentoAlterarPerfil(alvo: Alvo, novo: Perfil, executorId: string, usuarios: readonly Alvo[]) {
  if (alvo.id === executorId) return 'Você não pode alterar o próprio perfil.'
  if (alvo.papel === 'Administrador' && novo !== 'Administrador' && alvo.ativo && !outrosAdminsAtivos(usuarios, alvo.id)) {
    return 'O sistema precisa de pelo menos um administrador ativo.'
  }
  return null
}

// ===== Convite =====

export interface FormConvite {
  nome: string
  email: string
  papel: Perfil | ''
}

export const conviteVazio = (): FormConvite => ({ nome: '', email: '', papel: '' })

export type ErrosConvite = Partial<Record<keyof FormConvite, string>>

export function validarConvite(f: FormConvite, emailsExistentes: readonly string[]): ErrosConvite {
  const e: ErrosConvite = {}
  const nome = f.nome.trim()
  const email = f.email.trim().toLowerCase()
  if (validarCadastroUsuario({ nome }).nome) e.nome = 'Informe o nome completo.'
  if (!email) e.email = 'Informe o e-mail.'
  else if (!EMAIL.test(email)) e.email = 'Informe um e-mail válido.'
  else if (emailsExistentes.some((x) => x.toLowerCase() === email)) e.email = 'Já existe um usuário com este e-mail.'
  if (!f.papel) e.papel = 'Selecione o perfil.'
  return e
}

// ===== Cadastro =====

export function validarCadastroUsuario(f: { nome: string }): { nome?: string } {
  return f.nome.trim().length < 3 ? { nome: 'Informe o nome completo.' } : {}
}
