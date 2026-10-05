import { atualizarDb, lerDb } from '../data/db'
import type { Imovel, Usuario, UsuarioPublico } from '../data/types'

/**
 * Camada de serviço. Hoje grava no banco local (localStorage) com uma latência
 * simulada; quando o backend existir, basta trocar o corpo destas funções.
 */
const LATENCIA = import.meta.env.MODE === 'test' ? 0 : 450
const esperar = (ms = LATENCIA) => new Promise((r) => setTimeout(r, ms))

// IDs aleatórios com o gerador criptográfico do navegador (não previsíveis).
const novoId = (prefixo: string) => `${prefixo}-${crypto.randomUUID()}`

/** Dados do usuário sem a senha, para guardar na sessão. */
export function paraUsuarioPublico({ id, nome, email, papel }: Usuario): UsuarioPublico {
  return { id, nome, email, papel }
}

export async function autenticar(email: string, senha: string): Promise<UsuarioPublico> {
  await esperar()
  const usuario = lerDb().usuarios.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
  if (usuario?.senha !== senha) {
    throw new Error('E-mail ou senha incorretos.')
  }
  return paraUsuarioPublico(usuario)
}

/** Sempre responde com sucesso para não revelar quais e-mails existem. */
export async function solicitarRecuperacaoSenha(email: string) {
  await esperar()
  return { email: email.trim() }
}

export async function aprovarProposta(propostaId: string) {
  await esperar()
  const agora = new Date().toISOString()
  atualizarDb((db) => {
    const proposta = db.propostas.find((p) => p.id === propostaId)
    if (proposta?.status !== 'pendente') {
      throw new Error('Esta proposta já foi analisada.')
    }
    const { imovelId } = proposta
    return {
      ...db,
      // Aprovar uma proposta encerra as concorrentes do mesmo imóvel.
      propostas: db.propostas.map((p) => {
        if (p.id === propostaId) return { ...p, status: 'aprovada', decididaEm: agora }
        if (p.imovelId === imovelId && p.status === 'pendente') {
          return { ...p, status: 'recusada', decididaEm: agora, motivoRecusa: 'Outra proposta foi aprovada.' }
        }
        return p
      }),
      reservas: db.reservas.map((r) =>
        r.imovelId === imovelId && r.status === 'ativa' ? { ...r, status: 'convertida' } : r,
      ),
      imoveis: db.imoveis.map((i) =>
        i.id === imovelId ? { ...i, situacao: 'vendido', atualizadoEm: agora } : i,
      ),
      vendas: [
        ...db.vendas,
        {
          id: novoId('ven'),
          imovelId,
          clienteId: proposta.clienteId,
          propostaId,
          valor: proposta.valor,
          data: agora,
        },
      ],
    }
  })
}

export async function recusarProposta(propostaId: string, motivo: string) {
  await esperar()
  atualizarDb((db) => {
    const proposta = db.propostas.find((p) => p.id === propostaId)
    if (proposta?.status !== 'pendente') {
      throw new Error('Esta proposta já foi analisada.')
    }
    return {
      ...db,
      propostas: db.propostas.map((p) =>
        p.id === propostaId
          ? { ...p, status: 'recusada', decididaEm: new Date().toISOString(), motivoRecusa: motivo.trim() || undefined }
          : p,
      ),
    }
  })
}

export async function salvarImovel(dados: Omit<Imovel, 'id' | 'criadoEm' | 'atualizadoEm'> & { id?: string }) {
  await esperar()
  const agora = new Date().toISOString()
  let salvo!: Imovel
  atualizarDb((db) => {
    const codigoRepetido = db.imoveis.some((i) => i.codigo === dados.codigo && i.id !== dados.id)
    if (dados.codigo && codigoRepetido) {
      throw new Error(`Já existe um imóvel com o código interno ${dados.codigo}.`)
    }
    const existente = dados.id ? db.imoveis.find((i) => i.id === dados.id) : undefined
    salvo = {
      ...dados,
      id: existente?.id ?? novoId('imo'),
      criadoEm: existente?.criadoEm ?? agora,
      atualizadoEm: agora,
    }
    return {
      ...db,
      imoveis: existente
        ? db.imoveis.map((i) => (i.id === salvo.id ? salvo : i))
        : [...db.imoveis, salvo],
    }
  })
  return salvo
}

export async function excluirImovel(id: string) {
  await esperar()
  atualizarDb((db) => {
    const vinculado =
      db.reservas.some((r) => r.imovelId === id && r.status === 'ativa') ||
      db.propostas.some((p) => p.imovelId === id && p.status === 'pendente')
    if (vinculado) {
      throw new Error('Este imóvel tem reserva ativa ou proposta pendente e não pode ser excluído.')
    }
    return { ...db, imoveis: db.imoveis.filter((i) => i.id !== id) }
  })
}

export interface EnderecoCep {
  logradouro: string
  bairro: string
  cidade: string
  uf: string
}

/** Consulta o ViaCEP. Retorna null quando o CEP não existe. */
export async function buscarCep(cep: string, signal?: AbortSignal): Promise<EnderecoCep | null> {
  const digitos = cep.replace(/\D/g, '')
  const resposta = await fetch(`https://viacep.com.br/ws/${digitos}/json/`, { signal })
  if (!resposta.ok) throw new Error('Não foi possível consultar o CEP.')
  const json = await resposta.json()
  if (json.erro) return null
  return { logradouro: json.logradouro, bairro: json.bairro, cidade: json.localidade, uf: json.uf }
}
