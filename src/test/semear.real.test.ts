import { atualizarDb, lerDb } from '../data/db'
import { criarSeed } from '../data/seed'
import type { Db } from '../data/types'
import { entrarNaApi } from '../services/auth'
import { listarClientes, salvarCliente } from '../services/clientes'
import { definirToken, http } from '../services/http'
import { salvarLoteamento, sincronizarLoteamentos } from '../services/loteamentos'
import { comSincronizacao, sincronizarComApi } from '../services/sincronizacao'
import { salvarUsuario } from '../services/usuariosPermissoes'

/**
 * Envia os dados de demonstração do front para uma API vazia:
 *   VITE_API_URL=http://localhost:3001 VITE_SEMEAR=1 npx vitest run src/test/semear.real.test.ts
 * Usuários da equipe entram com a senha urbizzi123 (troca obrigatória no 1º acesso).
 */
const API = import.meta.env.VITE_API_URL as string | undefined
const SENHA_EQUIPE = 'urbizzi123'

const falhas: string[] = []
async function tentar<T>(rotulo: string, acao: () => Promise<T>) {
  try {
    return await acao()
  } catch (error_) {
    falhas.push(`${rotulo}: ${error_ instanceof Error ? error_.message : String(error_)}`)
    return undefined
  }
}

describe.runIf(API?.startsWith('http') && import.meta.env.VITE_SEMEAR === '1')('Semear dados de demonstração', () => {
  it('envia o seed do front para a API', async () => {
    vi.unstubAllGlobals()
    const sessao = await entrarNaApi(
      (import.meta.env.VITE_ADMIN_EMAIL as string | undefined) ?? 'admin@urbizzi.com',
      (import.meta.env.VITE_ADMIN_SENHA as string | undefined) ?? 'admin123',
    )
    definirToken(sessao.token)
    if ((await http<unknown[]>('/lote')).length > 0) {
      console.info('A API já tem imóveis; nada foi semeado.')
      return
    }
    const seed = criarSeed(new Date())

    for (const u of seed.usuarios.filter((x) => x.papel !== 'Administrador')) {
      await tentar(`usuário ${u.email}`, () =>
        salvarUsuario({ nome: u.nome, email: u.email, papel: u.papel, ativo: u.ativo !== false, senha: SENHA_EQUIPE } as never),
      )
    }

    const existentes = new Set((await sincronizarLoteamentos()).map((l) => l.nome))
    for (const l of seed.loteamentos.filter((x) => !existentes.has(x.nome))) {
      await tentar(`loteamento ${l.nome}`, () => salvarLoteamento({ ...l, id: undefined } as never))
    }

    const porDocumento = new Map((await listarClientes()).map((c) => [c.cpfCnpj.replace(/\D/g, ''), c.id]))
    const idCliente = new Map<string, string>()
    for (const c of seed.clientes) {
      const doc = c.cpfCnpj.replace(/\D/g, '')
      const id = porDocumento.get(doc) ?? (await tentar(`cliente ${c.nome}`, () => salvarCliente(c as never)))?.id
      if (id) idCliente.set(c.id, id)
    }

    await sincronizarComApi()
    const equipe = lerDb().usuarios
    const nomeSeed = new Map([...seed.usuarios, ...seed.corretores].map((p) => [p.id, p.nome]))
    const idPessoa = (id: string) => equipe.find((u) => u.nome === nomeSeed.get(id))?.id ?? id
    const cli = (id: string) => idCliente.get(id) ?? id

    // Reserva = proposta pendente: lote "reservado" sem proposta volta a disponível
    const comPendente = new Set(seed.propostas.filter((p) => p.status === 'pendente').map((p) => p.imovelId))
    const imoveis = seed.imoveis.map((i) =>
      i.situacao === 'reservado' && !comPendente.has(i.id) ? { ...i, situacao: 'disponivel' as const } : i,
    )
    const clientesOk = (x: { clienteId: string }) => idCliente.has(x.clienteId)

    const dados: Partial<Db> = {
      imoveis,
      propostas: seed.propostas.filter(clientesOk).map((p) => ({ ...p, clienteId: cli(p.clienteId), corretorId: idPessoa(p.corretorId) })),
      vendas: seed.vendas.filter(clientesOk).map((v) => ({ ...v, clienteId: cli(v.clienteId) })),
      interesses: seed.interesses,
      historico: seed.historico,
      documentos: seed.documentos,
      reservas: [],
    }
    await comSincronizacao(() => atualizarDb((db) => ({ ...db, ...dados })))
    await sincronizarComApi()

    console.info(
      `Semeado: ${lerDb().imoveis.length} imóveis, ${lerDb().propostas.length} propostas, ${lerDb().vendas.length} vendas, ` +
        `${idCliente.size} clientes. Falhas: ${falhas.length}`,
    )
    if (falhas.length) console.info(falhas.slice(0, 20).join('\n'))
    expect(lerDb().imoveis.length).toBeGreaterThan(0)
  }, 900_000)
})
