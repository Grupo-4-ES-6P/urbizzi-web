import { lerDb } from '../data/db'
import { PERFIL_NA_API, PERMISSOES_PADRAO, type Perfil } from '../data/permissoes'

interface UsuarioFalso {
  id: string
  name: string
  email: string
  password: string
  perfil: string
  status: string
  ultimoAcesso: string | null
}

let usuarios: UsuarioFalso[] = []
let matriz: Record<string, string[]> = {}

export function reiniciarApiFalsa() {
  usuarios = lerDb().usuarios.map((u) => ({
    id: u.id,
    name: u.nome,
    email: u.email,
    password: u.senha,
    perfil: PERFIL_NA_API[u.papel as Perfil],
    status: u.ativo === false ? 'INATIVO' : 'ATIVO',
    ultimoAcesso: u.ultimoAcesso ?? null,
  }))
  matriz = Object.fromEntries(
    Object.entries(PERMISSOES_PADRAO).map(([id, perfis]) => [id.toUpperCase(), perfis.map((p) => PERFIL_NA_API[p])]),
  )
}

export function usuariosDaApiFalsa() {
  return usuarios
}

export function matrizDaApiFalsa() {
  return matriz
}

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } })

const erro = (message: string, status: number) => json({ message, statusCode: status }, status)

const resposta = (u: UsuarioFalso) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  perfil: u.perfil,
  status: u.status,
  ultimoAcesso: u.ultimoAcesso,
  permissions: [],
  anexoId: null,
})

const adminAtivo = (u: UsuarioFalso) => u.perfil === 'ADMINISTRADOR' && u.status === 'ATIVO'

function semAdmin(id: string, proximo: UsuarioFalso | null) {
  const atual = usuarios.find((u) => u.id === id)
  if (!atual || !adminAtivo(atual) || (proximo && adminAtivo(proximo))) return false
  return !usuarios.some((u) => u.id !== id && adminAtivo(u))
}

function rotear(metodo: string, caminho: string, corpo: Record<string, unknown>): Response {
  if (metodo === 'POST' && caminho === '/auth/login') {
    const u = usuarios.find((x) => x.email === String(corpo.email).toLowerCase())
    if (!u || u.password !== corpo.senha) return erro('Email ou senha inválidos.', 401)
    if (u.status !== 'ATIVO') return erro('Usuário inativo ou aguardando ativação.', 401)
    u.ultimoAcesso = new Date().toISOString()
    const permissoes = Object.keys(matriz).filter((p) => matriz[p].includes(u.perfil))
    return json({
      accessToken: `token-${u.id}`,
      tokenType: 'Bearer',
      expiresIn: '1h',
      usuario: { id: u.id, nome: u.name, email: u.email, perfil: u.perfil, permissoes },
    })
  }

  if (metodo === 'GET' && caminho === '/users') return json(usuarios.map(resposta))

  if (metodo === 'POST' && caminho === '/users') {
    if (usuarios.some((u) => u.email === corpo.email)) return erro('Email already registered', 409)
    const novo: UsuarioFalso = {
      id: String(usuarios.length + 100),
      name: String(corpo.name),
      email: String(corpo.email),
      password: String(corpo.password),
      perfil: String(corpo.perfil ?? 'CORRETOR'),
      status: String(corpo.status),
      ultimoAcesso: null,
    }
    usuarios.push(novo)
    return json(resposta(novo), 201)
  }

  const porId = /^\/users\/([^/]+)$/.exec(caminho)
  if (porId && metodo === 'PUT') {
    const atual = usuarios.find((u) => u.id === porId[1])
    if (!atual) return erro('Usuário não encontrado.', 404)
    const proximo = {
      ...atual,
      ...(corpo.name ? { name: String(corpo.name) } : {}),
      ...(corpo.email ? { email: String(corpo.email) } : {}),
      ...(corpo.perfil ? { perfil: String(corpo.perfil) } : {}),
      ...(corpo.status ? { status: String(corpo.status) } : {}),
      ...(corpo.password ? { password: String(corpo.password) } : {}),
    }
    if (semAdmin(atual.id, proximo)) return erro('O sistema precisa de pelo menos um administrador ativo.', 400)
    usuarios = usuarios.map((u) => (u.id === atual.id ? proximo : u))
    return json(resposta(proximo))
  }

  if (caminho === '/permissoes' && metodo === 'GET') return json({ matriz })

  if (caminho === '/permissoes' && metodo === 'PUT') {
    const { permissao, perfil, liberado } = corpo as { permissao: string; perfil: string; liberado: boolean }
    if (permissao === 'GERENCIAR_USUARIOS' && perfil === 'ADMINISTRADOR' && !liberado) {
      return erro('O administrador sempre gerencia usuários e permissões.', 400)
    }
    const atuais = matriz[permissao] ?? []
    matriz = {
      ...matriz,
      [permissao]: liberado ? [...new Set([...atuais, perfil])] : atuais.filter((p) => p !== perfil),
    }
    return json({ matriz })
  }

  return erro(`Rota não simulada: ${metodo} ${caminho}`, 404)
}

export async function fetchFalso(entrada: RequestInfo | URL, init?: RequestInit) {
  const url = new URL(String(entrada), 'http://localhost')
  const caminho = url.pathname.replace(/^\/api/, '')
  const corpo = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {}
  return rotear(init?.method ?? 'GET', caminho, corpo)
}
