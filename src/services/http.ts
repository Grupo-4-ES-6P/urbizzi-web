const BASE = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '')

export class ErroApi extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'ErroApi'
  }
}

let token: string | null = null
const ouvintesSessaoExpirada = new Set<() => void>()

export function definirToken(novo: string | null) {
  token = novo
}

/** Avisado quando a API responde 401 numa requisição autenticada. */
export function aoExpirarSessao(ouvinte: () => void) {
  ouvintesSessaoExpirada.add(ouvinte)
  return () => {
    ouvintesSessaoExpirada.delete(ouvinte)
  }
}

interface OpcoesHttp {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
}

function mensagemDeErro(corpo: unknown, status: number) {
  const message = (corpo as { message?: unknown } | null)?.message
  if (Array.isArray(message)) return message.join(' ')
  if (typeof message === 'string' && message) return message
  return status >= 500 ? 'O servidor encontrou um erro. Tente novamente.' : 'Não foi possível concluir a operação.'
}

export async function http<T>(caminho: string, { method = 'GET', body, signal }: OpcoesHttp = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  // FormData (upload): o navegador monta o Content-Type com o boundary
  const formulario = body instanceof FormData
  if (body !== undefined && !formulario) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  let resposta: Response
  try {
    resposta = await fetch(`${BASE}${caminho}`, {
      method,
      headers,
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
      signal,
    })
  } catch (error_) {
    if (error_ instanceof DOMException && error_.name === 'AbortError') throw error_
    throw new ErroApi('Não foi possível conectar ao servidor.', 0)
  }

  const texto = await resposta.text()
  let corpo: unknown = null
  if (texto) {
    try {
      corpo = JSON.parse(texto)
    } catch {
      corpo = null
    }
  }

  if (!resposta.ok) {
    if (resposta.status === 401 && token) ouvintesSessaoExpirada.forEach((o) => o())
    throw new ErroApi(mensagemDeErro(corpo, resposta.status), resposta.status)
  }

  return corpo as T
}
