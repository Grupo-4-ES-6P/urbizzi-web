import { atualizarDb, lerDb } from '../data/db'
import { aprovarProposta, cancelarVenda, enviarDocumento, registrarInteresse, salvarImovel } from '../services/api'
import { entrarNaApi } from '../services/auth'
import { definirToken, http } from '../services/http'
import { salvarProposta } from '../services/propostas'
import { sincronizarCatalogo, sincronizarComApi } from '../services/sincronizacao'

/**
 * Roda os services do front contra a API real (Docker):
 *   VITE_API_URL=http://localhost:18080/api npx vitest run src/test/integracao.real.test.ts
 */
const API = import.meta.env.VITE_API_URL as string | undefined

function dadosImovel(sufixo: string) {
  return {
    codigo: `C${sufixo}`,
    titulo: 'Terreno E2E',
    matricula: `M${sufixo}`,
    tipo: 'Terreno em loteamento',
    loteamento: `Lot E2E ${sufixo}`,
    situacao: 'disponivel',
    endereco: { cep: '85900-010', logradouro: 'Rua A', numero: '1', bairro: 'Centro', cidade: 'Toledo', uf: 'PR', quadra: '01', lote: '1' },
    geo: { lat: -24.7, lng: -53.7 },
    dimensoes: { areaTotal: 360, frente: 12, fundo: 30, topografia: 'Plano' },
    valores: { tabela: 90000, minimo: 80000, prazoReservaHoras: 72 },
    publicacao: { catalogo: true, reservasOnline: true, destaque: false },
    fotos: ['data:image/png;base64,iVBORw0KGgo='],
    status: 'publicado',
  } as Parameters<typeof salvarImovel>[0]
}

describe.runIf(API?.startsWith('http'))('Integração com a API real', () => {
  beforeEach(async () => {
    vi.unstubAllGlobals()
    // fetch real é do Node: o FormData/File do jsdom viraria "[object FormData]"
    const nativo = await new Response(new URLSearchParams('a=1')).formData()
    const modulo = 'node:buffer'
    const { File: FileNativo } = (await import(/* @vite-ignore */ modulo)) as { File: typeof File }
    vi.stubGlobal('FormData', nativo.constructor)
    vi.stubGlobal('File', FileNativo)
    atualizarDb((db) => ({ ...db, imoveis: [], propostas: [], reservas: [], vendas: [], historico: [], documentos: [], interesses: [] }))
    const sessao = await entrarNaApi('admin@urbizzi.com', 'admin123')
    definirToken(sessao.token)
  })

  it('cadastro de imóvel → proposta → aprovação → venda → cancelamento, tudo na API', async () => {
    const sufixo = Date.now().toString().slice(-6)
    await http('/loteamentos', { method: 'POST', body: { nome: `Lot E2E ${sufixo}`, codigo: `E${sufixo}`, situacao: 'em_comercializacao' } })
    const cliente = await http<{ cliente: { id: string } }>('/clientes', {
      method: 'POST',
      body: { tipoDocumento: 'CPF', documentoIdentificacao: '52998224725', nome: 'Maria E2E', email: 'e2e@x.com' },
    }).catch(() => null)
    await sincronizarComApi()
    const clienteId = cliente?.cliente.id ?? lerDb().clientes[0]?.id ?? (await http<{ data: { id: string }[] }>('/clientes')).data[0].id
    atualizarDb((db) => ({ ...db, clientes: [{ id: clienteId, nome: 'Maria E2E' } as never] }))

    const salvo = await salvarImovel(dadosImovel(sufixo))
    expect(salvo.id).toMatch(/^\d+$/)
    const lote = await http<{ idQuadra: string; detalhes: { titulo: string } }>(`/lote/${salvo.id}`)
    expect(lote.detalhes.titulo).toBe('Terreno E2E')
    expect(lote.idQuadra).toMatch(/^\d+$/)

    const idProposta = await salvarProposta(
      {
        imovelId: salvo.id,
        clienteId,
        valor: 85000,
        entrada: 17000,
        parcelas: 24,
        indiceCorrecao: 'IGP-M',
        primeiroVencimento: '2026-12-20',
        formaPagamento: 'Entrada + financiamento direto',
        validadeDias: 7,
      },
      'pendente',
      undefined,
      { id: '1', nome: 'Administrador', email: '', papel: 'Administrador' },
    )
    expect(idProposta).toMatch(/^\d+$/)

    await aprovarProposta(idProposta, 'Administrador')
    const proposta = await http<{ status: string }>(`/propostas/${idProposta}`)
    expect(proposta.status).toBe('aprovada')
    const vendas = await http<{ id: string; status: string; detalhes: { propostaId: string } }[]>(`/vendas?idLote=${salvo.id}`)
    expect(vendas).toHaveLength(1)
    expect(vendas[0].detalhes.propostaId).toBe(idProposta)
    expect((await http<{ estado: string }>(`/lote/${salvo.id}`)).estado).toBe('vendido')
    expect((await http<unknown[]>(`/historico?idLote=${salvo.id}`)).length).toBeGreaterThan(0)

    await cancelarVenda(vendas[0].id, { motivo: 'Distrato', dataDistrato: '2026-11-22', devolucao: 1000 } as never, 'Administrador')
    expect((await http<{ status: string }>(`/vendas/${vendas[0].id}`)).status).toBe('cancelada')

    const pdf = new File(['%PDF-1.4 teste'], 'matricula.pdf', { type: 'application/pdf' })
    await enviarDocumento(salvo.id, { tipo: 'Matrícula', arquivo: pdf, visivelCatalogo: false }, 'Administrador')
    const [doc] = await http<{ detalhes: { conteudo: string } }[]>(`/documentos?idLote=${salvo.id}`)
    expect(doc.detalhes.conteudo).toMatch(/^\/uploads\/.+\.pdf$/)
    expect((await fetch(new URL(doc.detalhes.conteudo, API)).then((r) => r.text()))).toBe('%PDF-1.4 teste')

    // Depois de tudo, um espelho novo tem que bater com o que a tela mostrava.
    const local = lerDb().vendas.find((v) => v.id === vendas[0].id)
    await sincronizarComApi()
    expect(lerDb().vendas.find((v) => v.id === vendas[0].id)?.status).toBe(local?.status)
    expect(lerDb().imoveis.find((i) => i.id === salvo.id)?.titulo).toBe('Terreno E2E')
  })

  it('visitante vê o catálogo sem dados internos e envia interesse', async () => {
    const sufixo = Date.now().toString().slice(-6)
    await http('/loteamentos', { method: 'POST', body: { nome: `Lot E2E ${sufixo}`, codigo: `E${sufixo}`, situacao: 'em_comercializacao' } })
    await sincronizarComApi()
    const publicado = await salvarImovel(dadosImovel(sufixo))

    definirToken(null)
    await sincronizarCatalogo()
    const imovel = lerDb().imoveis.find((i) => i.id === publicado.id)
    expect(imovel).toBeDefined()
    if (!imovel) return
    expect(imovel.valores.minimo).toBeNull()
    const codigo = await registrarInteresse(imovel.id, { nome: 'Visitante E2E', email: 'v@x.com', telefone: '45999999999', mensagem: 'Oi' })
    expect(codigo).toMatch(/^INT-/)
  })
})
