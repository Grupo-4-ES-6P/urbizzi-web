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
  trocarSenha?: boolean
}

type ClienteFalso = Record<string, unknown> & {
  id: string
  documentoIdentificacao: string
  nome: string | null
  razaoSocial: string | null
  email: string | null
  status: string
  contatos: Record<string, unknown>[]
}

let usuarios: UsuarioFalso[] = []
let matriz: Record<string, string[]> = {}
let clientes: ClienteFalso[] = []
let proximoCliente = 1

const digitos = (v: unknown) => (typeof v === 'string' ? v.replace(/\D/g, '') : '') || null
const textoOuNulo = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

function clienteDoCorpo(corpo: Record<string, unknown>, atual?: ClienteFalso): ClienteFalso {
  const e = (corpo.endereco ?? {}) as Record<string, unknown>
  const agora = new Date().toISOString()
  return {
    ...atual,
    id: atual?.id ?? `cli-api-${proximoCliente++}`,
    tipoDocumento: corpo.tipoDocumento,
    documentoIdentificacao: digitos(corpo.documentoIdentificacao) ?? '',
    nome: textoOuNulo(corpo.nome),
    razaoSocial: textoOuNulo(corpo.razaoSocial),
    nomeFantasia: null,
    telefone: digitos(corpo.telefone),
    celular: digitos(corpo.celular),
    email: textoOuNulo(corpo.email)?.toLowerCase() ?? null,
    origem: textoOuNulo(corpo.origem),
    rg: textoOuNulo(corpo.rg),
    dataNascimento: textoOuNulo(corpo.dataNascimento),
    estadoCivil: textoOuNulo(corpo.estadoCivil),
    profissao: textoOuNulo(corpo.profissao),
    responsavel: textoOuNulo(corpo.responsavel),
    imovelInteresseId: textoOuNulo(corpo.imovelInteresseId),
    endereco: {
      cep: digitos(e.cep),
      logradouro: textoOuNulo(e.logradouro),
      numero: textoOuNulo(e.numero),
      complemento: textoOuNulo(e.complemento),
      bairro: textoOuNulo(e.bairro),
      cidade: textoOuNulo(e.cidade),
      uf: textoOuNulo(e.uf)?.toUpperCase() ?? null,
      pais: textoOuNulo(e.pais),
    },
    contatos: ((corpo.contatos ?? atual?.contatos ?? []) as Record<string, unknown>[]).map((c, i) => ({
      ...c,
      id: String(i + 1),
      imovelId: textoOuNulo(c.imovelId),
    })),
    status: atual?.status ?? 'ATIVO',
    dataCadastro: atual?.dataCadastro ?? agora,
    dataAtualizacao: agora,
  }
}

export function clientesDaApiFalsa() {
  return clientes
}

let loteamentos: Record<string, unknown>[] = []
let proximoLoteamento = 1

export function loteamentosDaApiFalsa() {
  return loteamentos
}

function loteamentoDoCorpo(corpo: Record<string, unknown>, atual?: Record<string, unknown>) {
  return {
    descricao: '',
    publicado: false,
    idBairro: null,
    ...atual,
    ...Object.fromEntries(Object.entries(corpo).map(([k, v]) => [k, v === '' ? null : v])),
    cep: corpo.cep === undefined ? (atual?.cep ?? null) : digitos(corpo.cep),
    idLoteamento: atual?.idLoteamento ?? `lot-api-${proximoLoteamento++}`,
  }
}

type Registro = Record<string, unknown> & { id: string }

/** Reservas, vendas, interesses, histórico e documentos: mesmo formato da API. */
let registros: Record<string, Registro[]> = {}
let propostas: Record<string, unknown>[] = []
let proximoRegistro = 1

export function registrosDaApiFalsa(rota: string) {
  return registros[rota] ?? []
}

export function propostasDaApiFalsa() {
  return propostas
}

function semeiaRegistros() {
  const db = lerDb()
  const comoRegistro = (item: { id: string; imovelId?: string; clienteId?: string }, status?: unknown): Registro => {
    const { id, ...detalhes } = item as Registro
    return { id, idLote: item.imovelId ?? null, idCliente: item.clienteId ?? null, status: status ?? null, detalhes }
  }
  registros = {
    reservas: db.reservas.map((r) => comoRegistro(r, r.status)),
    vendas: db.vendas.map((v) => comoRegistro(v, v.status)),
    interesses: db.interesses.map((i) => comoRegistro(i)),
    historico: db.historico.map((h) => comoRegistro(h, h.tipo)),
    documentos: db.documentos.map((d) => comoRegistro(d, d.tipo)),
  }
  propostas = db.propostas.map(({ id, ...detalhes }) => ({
    idProposta: id,
    status: detalhes.status,
    idLote: detalhes.imovelId,
    idCliente: detalhes.clienteId,
    detalhes,
  }))
  proximoRegistro = 1
}

function rotearRegistros(metodo: string, caminho: string, corpo: Record<string, unknown>): Response | null {
  const [, rota, id] = /^\/(reservas|vendas|interesses|historico|documentos)(?:\/([^/]+))?$/.exec(caminho) ?? []
  if (!rota) return null
  const lista = registros[rota]
  if (!id && metodo === 'GET') return json(lista)
  if (!id && metodo === 'POST') {
    const novo = { ...corpo, id: `${rota}-api-${proximoRegistro++}` } as Registro
    registros[rota] = [...lista, novo]
    return json(novo, 201)
  }
  const atual = lista.find((r) => r.id === id)
  if (!atual) return erro('Registro não encontrado.', 404)
  if (metodo === 'PUT') {
    const salvo = { ...atual, ...corpo }
    registros[rota] = lista.map((r) => (r === atual ? salvo : r))
    return json(salvo)
  }
  if (metodo === 'DELETE') {
    registros[rota] = lista.filter((r) => r !== atual)
    return new Response(null, { status: 204 })
  }
  return json(atual)
}

function rotearPropostas(metodo: string, caminho: string, corpo: Record<string, unknown>): Response | null {
  const [, id] = /^\/propostas(?:\/([^/]+))?$/.exec(caminho) ?? []
  if (!caminho.startsWith('/propostas')) return null
  if (!id && metodo === 'GET') return json(propostas)
  if (!id && metodo === 'POST') {
    const nova = { ...corpo, idProposta: `prop-api-${proximoRegistro++}` }
    propostas = [...propostas, nova]
    return json(nova, 201)
  }
  const atual = propostas.find((p) => p.idProposta === id)
  if (!atual) return erro('Proposta não encontrada.', 404)
  if (metodo === 'PATCH') {
    const salva = { ...atual, ...corpo }
    propostas = propostas.map((p) => (p === atual ? salva : p))
    return json(salva)
  }
  if (metodo === 'DELETE') {
    propostas = propostas.filter((p) => p !== atual)
    return new Response(null, { status: 204 })
  }
  return json(atual)
}

export const uploadsDaApiFalsa: string[] = []

function rotearPublico(metodo: string, caminho: string, corpo: Record<string, unknown>): Response | null {
  if (caminho === '/anexos/upload' && metodo === 'POST') {
    const arquivo = corpo.arquivo as File | null
    if (!arquivo) return erro("Envie o arquivo no campo 'arquivo'.", 400)
    const url = `/uploads/falso-${uploadsDaApiFalsa.length + 1}-${arquivo.name}`
    uploadsDaApiFalsa.push(url)
    return json({ idAnexo: uploadsDaApiFalsa.length, url }, 201)
  }
  if (caminho === '/users/equipe' && metodo === 'GET') {
    return json(usuarios.map((u) => ({ id: u.id, nome: u.name, perfil: u.perfil, ativo: u.status === 'ATIVO' })))
  }
  if (caminho === '/publico/catalogo' && metodo === 'GET') {
    const publicados = lotes.filter(
      (l) => l.publicado && (l.detalhes as { status?: string }).status !== 'rascunho',
    )
    return json({
      imoveis: publicados.map((l) => {
        const detalhes = { ...(l.detalhes as Record<string, unknown>) }
        delete detalhes.bloqueio
        delete detalhes.observacao
        return { ...l, informacoesComplementares: null, detalhes }
      }),
      loteamentos: loteamentos.map((l) => ({ ...l })),
    })
  }
  if (caminho === '/publico/interesses' && metodo === 'POST') {
    const lote = lotes.find((l) => l.id === corpo.idLote && l.publicado)
    if (!lote) return erro('Imóvel indisponível no catálogo.', 400)
    const codigo = `INT-${String(registros.interesses.length + 1).padStart(4, '0')}`
    const { idLote, ...dados } = corpo
    registros.interesses = [
      ...registros.interesses,
      { id: `interesses-api-${proximoRegistro++}`, codigo, idLote, status: 'novo', detalhes: { ...dados, codigo, imovelId: idLote } },
    ]
    return json({ id: 'x', codigo }, 201)
  }
  return null
}

let lotes: Record<string, unknown>[] = []
let proximoLote = 1

export function lotesDaApiFalsa() {
  return lotes
}

function loteDoImovel(i: ReturnType<typeof lerDb>['imoveis'][number]) {
  const { id, matricula, tipo, situacao, observacao, geo, ...detalhes } = i
  return {
    id,
    matricula: matricula || null,
    tipo,
    areaQuadrada: i.dimensoes.areaTotal,
    valor: i.valores.tabela,
    estado: situacao,
    informacoesComplementares: observacao ?? null,
    latitude: geo.lat,
    longitude: geo.lng,
    publicado: i.publicacao.catalogo,
    idQuadra: null,
    detalhes,
    createdAt: i.criadoEm,
    updatedAt: i.atualizadoEm,
  }
}

function rotearLotes(metodo: string, caminho: string, corpo: Record<string, unknown>): Response | null {
  if (caminho === '/lote' && metodo === 'GET') return json(lotes)
  if (caminho === '/lote' && metodo === 'POST') {
    if (corpo.matricula && lotes.some((l) => l.matricula === corpo.matricula)) {
      return erro('Lote com essa matrícula já existente', 409)
    }
    const agora = new Date().toISOString()
    const novo = { ...corpo, id: `lote-api-${proximoLote++}`, createdAt: agora, updatedAt: agora }
    lotes = [...lotes, novo]
    return json(novo, 201)
  }
  const rota = /^\/lote\/([^/]+)$/.exec(caminho)
  if (!rota) return null
  const atual = lotes.find((l) => l.id === rota[1])
  if (!atual) return erro('Lote não encontrado', 404)
  if (metodo === 'PUT') {
    const salvo = { ...atual, ...corpo, updatedAt: new Date().toISOString() }
    lotes = lotes.map((l) => (l === atual ? salvo : l))
    return json(salvo)
  }
  if (metodo === 'DELETE') {
    lotes = lotes.filter((l) => l !== atual)
    return new Response(null, { status: 204 })
  }
  return metodo === 'GET' ? json(atual) : null
}

let quadras: Record<string, unknown>[] = []

export function quadrasDaApiFalsa() {
  return quadras
}

function rotearQuadras(metodo: string, caminho: string, corpo: Record<string, unknown>): Response | null {
  if (caminho === '/quadras' && metodo === 'GET') return json(quadras)
  if (caminho === '/quadras' && metodo === 'POST') {
    const idLoteamento = String(corpo.idLoteamento)
    if (!loteamentos.some((l) => l.idLoteamento === idLoteamento)) return erro('Loteamento não encontrado.', 400)
    if (quadras.some((q) => q.idLoteamento === idLoteamento && q.identificacao === corpo.identificacao)) {
      return erro(`Já existe a quadra ${String(corpo.identificacao)} neste loteamento.`, 409)
    }
    const nova = { ...corpo, id: `qua-api-${quadras.length + 1}`, idLoteamento, criadaEm: new Date().toISOString() }
    quadras = [...quadras, nova]
    return json(nova, 201)
  }
  return null
}

function rotearLoteamentos(metodo: string, caminho: string, corpo: Record<string, unknown>): Response | null {
  if (caminho === '/loteamentos' && metodo === 'GET') return json(loteamentos)
  if (caminho === '/loteamentos' && metodo === 'POST') {
    const novo = loteamentoDoCorpo(corpo)
    loteamentos = [...loteamentos, novo]
    return json(novo, 201)
  }
  const rota = /^\/loteamentos\/([^/]+)$/.exec(caminho)
  if (!rota) return null
  const atual = loteamentos.find((l) => l.idLoteamento === rota[1])
  if (!atual) return erro('Loteamento não encontrado.', 404)
  if (metodo === 'GET') return json(atual)
  if (metodo === 'PATCH') {
    const salvo = loteamentoDoCorpo(corpo, atual)
    loteamentos = loteamentos.map((l) => (l === atual ? salvo : l))
    return json(salvo)
  }
  if (metodo === 'DELETE') {
    loteamentos = loteamentos.filter((l) => l !== atual)
    return new Response(null, { status: 204 })
  }
  return null
}

export function reiniciarApiFalsa() {
  emailsDaApiFalsa.length = 0
  tokensUsados.clear()
  semeiaRegistros()
  proximoLote = 1
  lotes = lerDb().imoveis.map(loteDoImovel)
  proximoCliente = 1
  proximoLoteamento = 1
  const idPorNome = new Map(lerDb().loteamentos.map((l) => [l.nome, l.id]))
  quadras = lerDb().quadras.map(({ loteamento, ...q }) => ({ ...q, idLoteamento: idPorNome.get(loteamento) ?? '' }))
  loteamentos = lerDb().loteamentos.map(({ id, centro, ...l }) =>
    loteamentoDoCorpo({ ...l, latitude: centro?.lat ?? null, longitude: centro?.lng ?? null }, { idLoteamento: id }),
  )
  clientes = lerDb().clientes.map((c) => ({
    ...clienteDoCorpo({
      ...c,
      tipoDocumento: c.tipoPessoa === 'fisica' ? 'CPF' : 'CNPJ',
      documentoIdentificacao: c.cpfCnpj,
      nome: c.tipoPessoa === 'fisica' ? c.nome : null,
      razaoSocial: c.tipoPessoa === 'fisica' ? null : c.nome,
    }),
    id: c.id,
    status: c.ativo ? 'ATIVO' : 'INATIVO',
  }))
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

/** Links de redefinição "enviados" por e-mail. */
export const emailsDaApiFalsa: { para: string; token: string }[] = []
const tokensUsados = new Set<string>()
let tokenAtual = ''

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
      usuario: { id: u.id, nome: u.name, email: u.email, perfil: u.perfil, permissoes, trocarSenha: u.trocarSenha === true },
    })
  }

  const semConteudo = (status: number) => new Response(null, { status })

  if (metodo === 'POST' && caminho === '/auth/trocar-senha') {
    const u = usuarios.find((x) => `token-${x.id}` === tokenAtual)
    if (!u) return erro('Unauthorized', 401)
    if (u.password !== corpo.senhaAtual) return erro('Senha atual incorreta.', 400)
    u.password = String(corpo.novaSenha)
    u.trocarSenha = false
    return semConteudo(204)
  }

  if (metodo === 'POST' && caminho === '/auth/recuperar-senha') {
    const u = usuarios.find((x) => x.email === String(corpo.email).toLowerCase() && x.status === 'ATIVO')
    if (u) emailsDaApiFalsa.push({ para: u.email, token: `reset-${u.id}-${emailsDaApiFalsa.length}` })
    return semConteudo(202)
  }

  if (metodo === 'POST' && caminho === '/auth/redefinir-senha') {
    const token = String(corpo.token)
    const enviado = emailsDaApiFalsa.find((e) => e.token === token)
    const u = enviado && usuarios.find((x) => x.email === enviado.para)
    if (!u || tokensUsados.has(token)) return erro('Link inválido ou expirado. Peça um novo.', 400)
    tokensUsados.add(token)
    u.password = String(corpo.novaSenha)
    u.trocarSenha = false
    return semConteudo(204)
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
      trocarSenha: true,
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
      ...(corpo.password ? { password: String(corpo.password), trocarSenha: true } : {}),
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

  const respostaCliente =
    rotearClientes(metodo, caminho, corpo) ??
    rotearLoteamentos(metodo, caminho, corpo) ??
    rotearQuadras(metodo, caminho, corpo) ??
    rotearLotes(metodo, caminho, corpo) ??
    rotearRegistros(metodo, caminho, corpo) ??
    rotearPropostas(metodo, caminho, corpo) ??
    rotearPublico(metodo, caminho, corpo)
  if (respostaCliente) return respostaCliente

  return erro(`Rota não simulada: ${metodo} ${caminho}`, 404)
}

function rotearClientes(metodo: string, caminho: string, corpo: Record<string, unknown>): Response | null {
  if (caminho === '/clientes' && metodo === 'GET') {
    return json({ data: clientes, page: { page: 1, perPage: 100, totalItems: clientes.length, totalPages: 1 } })
  }

  const duplicado = (doc: string | null, id?: string) =>
    clientes.some((c) => c.id !== id && c.documentoIdentificacao === doc)

  if (caminho === '/clientes' && metodo === 'POST') {
    const novo = clienteDoCorpo(corpo)
    if (duplicado(novo.documentoIdentificacao)) return erro('Já existe cliente com este CPF ou CNPJ.', 409)
    clientes = [...clientes, novo]
    return json({ cliente: novo }, 201)
  }

  const rota = /^\/clientes\/([^/]+)(?:\/(desativar|reativar))?$/.exec(caminho)
  if (!rota) return null
  const atual = clientes.find((c) => c.id === rota[1])
  if (!atual) return erro('Cliente não encontrado.', 404)

  let salvo = atual
  if (metodo === 'GET') return json(atual)
  if (metodo === 'DELETE') {
    clientes = clientes.filter((c) => c.id !== atual.id)
    return new Response(null, { status: 204 })
  }
  if (metodo === 'PATCH' && rota[2]) salvo = { ...atual, status: rota[2] === 'desativar' ? 'INATIVO' : 'ATIVO' }
  else if (metodo === 'PATCH') {
    salvo = clienteDoCorpo(corpo, atual)
    if (duplicado(salvo.documentoIdentificacao, atual.id)) return erro('Já existe cliente com este CPF ou CNPJ.', 409)
  } else return null

  clientes = clientes.map((c) => (c.id === atual.id ? salvo : c))
  return json(salvo)
}

export async function fetchFalso(entrada: RequestInfo | URL, init?: RequestInit) {
  const url = new URL(String(entrada), 'http://localhost')
  const caminho = url.pathname.replace(/^\/api/, '')
  tokenAtual = ((init?.headers as Record<string, string> | undefined)?.Authorization ?? '').replace(/^Bearer /, '')
  const corpo =
    init?.body instanceof FormData
      ? { arquivo: init.body.get('arquivo') }
      : init?.body
        ? (JSON.parse(String(init.body)) as Record<string, unknown>)
        : {}
  return rotear(init?.method ?? 'GET', caminho, corpo)
}
