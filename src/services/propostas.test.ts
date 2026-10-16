import { lerDb } from '../data/db'
import { reservaAtiva } from '../data/selectors'
import { calcularCondicoes, formDaVersao, formVazio, propostaAberta, versaoAtual, type FormProposta } from '../lib/propostas'
import { dataCalendario } from '../lib/reservas'
import {
  aprovarProposta,
  criarNovaVersao,
  enviarProposta,
  iniciarAnalise,
  recusarProposta,
  salvarRascunhoProposta,
} from './propostas'

const ADMIN = { id: 'usr-1', nome: 'Ayran Bade' }
const GESTOR = { id: 'usr-2', nome: 'Matheus Oening' }
const GERENTE = { id: 'usr-3', nome: 'Gabriela Krüger' }

const erroDe = (p: Promise<unknown>) => p.then(() => '', (e: Error) => e.message)
const proposta = (id: string) => lerDb().propostas.find((p) => p.id === id)!
const porSituacao = (s: string) => lerDb().propostas.find((p) => p.situacao === s)!

/** Reserva ativa sem proposta aberta. */
const reservaLivre = () => {
  const db = lerDb()
  return db.reservas.find((r) => reservaAtiva(r, Date.now()) && !propostaAberta(db.propostas, r.id, Date.now()))!
}

const form = (parcial: Partial<FormProposta> = {}): FormProposta => ({
  ...formVazio({ hoje: dataCalendario(new Date()) }),
  descontoPercentual: '1',
  entrada: 20_000,
  parcelas: '24',
  ...parcial,
})

describe('criação e envio (RF17, RF32)', () => {
  it('só gera proposta a partir de reserva ativa', async () => {
    const cancelada = lerDb().reservas.find((r) => r.status === 'cancelada')!
    expect(await erroDe(enviarProposta({ reservaId: cancelada.id, form: form() }, 'x'))).toBe(
      'Propostas só podem ser geradas a partir de uma reserva ativa (RF17).',
    )
  })

  it('não abre uma segunda proposta para a mesma reserva', async () => {
    const lote12 = lerDb().propostas[0]
    expect(await erroDe(enviarProposta({ reservaId: lote12.reservaId, form: form() }, 'x'))).toMatch(/já tem a proposta PROP-\d{4}-0311/)
  })

  it('salva rascunho incompleto e depois envia o mesmo registro com auditoria', async () => {
    const reserva = reservaLivre()
    const total = lerDb().propostas.length
    const rascunho = await salvarRascunhoProposta({ reservaId: reserva.id, form: form({ descontoPercentual: '3', aprovadorId: '' }) }, 'Ayran Bade')

    expect(rascunho).toMatchObject({ situacao: 'rascunho', etapas: [], expiraEm: undefined, imovelId: reserva.imovelId, clienteId: reserva.clienteId })
    expect(rascunho.codigo).toMatch(/^PROP-\d{4}-\d{4}$/)
    expect(await erroDe(enviarProposta({ reservaId: reserva.id, propostaId: rascunho.id, form: form({ descontoPercentual: '3', aprovadorId: '' }) }, 'x'))).toBe(
      'Desconto acima da alçada: selecione o aprovador.',
    )

    const enviada = await enviarProposta({ reservaId: reserva.id, propostaId: rascunho.id, form: form({ descontoPercentual: '3', aprovadorId: 'usr-3' }) }, 'Ayran Bade')
    expect(lerDb().propostas).toHaveLength(total + 1)
    expect(enviada.id).toBe(rascunho.id)
    expect(enviada.situacao).toBe('enviada')
    expect(enviada.expiraEm).toBeDefined()
    expect(enviada.versoes).toHaveLength(1)
    expect(enviada.versoes[0]).toMatchObject({ numero: 1, situacao: 'em_analise', acimaDaAlcada: true, aprovadorId: 'usr-3' })
    expect(enviada.etapas.map((e) => [e.tipo, e.estado, e.responsavelId])).toEqual([
      ['envio', 'concluida', ''],
      ['analise_comercial', 'aguardando', 'usr-3'],
      ['contrato', 'pendente', ''],
    ])
    const envio = enviada.historico.at(-1)!
    expect(envio).toMatchObject({ tipo: 'envio', autor: 'Ayran Bade', versao: 1 })
    expect(envio.detalhe).toMatch(/^v1 · R\$\s\d.* · desconto 3% \(acima da alçada\) · entrada R\$\s20\.000 · 24x de R\$/)
    expect(lerDb().historico.some((e) => e.referencia === enviada.codigo && e.tipo === 'Proposta')).toBe(true)
  })

  it('dentro da alçada e sem aprovador, a análise vai para o gestor padrão; acima de 5% inclui a diretoria', async () => {
    const dentro = await enviarProposta({ reservaId: reservaLivre().id, form: form({ descontoPercentual: '2' }) }, 'x')
    expect(dentro.etapas[1].responsavelId).toBe('usr-2')
    expect(dentro.etapas.some((e) => e.tipo === 'diretoria')).toBe(false)

    const acima = await enviarProposta({ reservaId: reservaLivre().id, form: form({ descontoPercentual: '6', aprovadorId: 'usr-3' }) }, 'x')
    expect(acima.etapas.map((e) => e.tipo)).toEqual(['envio', 'analise_comercial', 'diretoria', 'contrato'])
    expect(acima.etapas[2].responsavelId).toBe('usr-1')
  })
})

describe('versões (RF18)', () => {
  it('nova versão cria vN+1 sem sobrescrever as anteriores', async () => {
    const original = lerDb().propostas[0]
    const antes = structuredClone(original.versoes)
    const v3 = versaoAtual(original)

    const atualizada = await criarNovaVersao(original.id, { ...formDaVersao(v3), parcelas: '36', comentario: 'Cliente pediu prazo maior.' }, { id: 'usr-9', nome: 'Gustavo Marques' })

    expect(atualizada.versoes).toHaveLength(4)
    // Condições das versões antigas ficam idênticas; só a situação da anterior muda.
    atualizada.versoes.slice(0, 3).forEach((v, i) => {
      expect(v.condicoes).toEqual(antes[i].condicoes)
      expect(v.oQueMudou).toBe(antes[i].oQueMudou)
    })
    expect(atualizada.versoes.map((v) => v.situacao)).toEqual(['substituida', 'substituida', 'substituida', 'em_analise'])
    expect(atualizada.versoes[3]).toMatchObject({ numero: 4, autor: 'Gustavo Marques', oQueMudou: 'Parcelamento alterado de 24x para 36x', comentario: 'Cliente pediu prazo maior.' })
    // O desconto fracionado é preservado quando o campo não foi editado.
    expect(atualizada.versoes[3].condicoes.descontoPercentual).toBe(v3.condicoes.descontoPercentual)
    expect(atualizada.situacao).toBe('enviada')
    expect(atualizada.etapas[1]).toMatchObject({ tipo: 'analise_comercial', estado: 'aguardando' })
    expect(atualizada.historico.at(-1)).toMatchObject({ tipo: 'nova_versao', versao: 4 })
  })

  it('exige alguma mudança ou um comentário', async () => {
    const p = lerDb().propostas[0]
    expect(await erroDe(criarNovaVersao(p.id, formDaVersao(versaoAtual(p)), GESTOR))).toBe(
      'Altere alguma condição ou explique a nova versão no comentário.',
    )
    const comComentario = await criarNovaVersao(p.id, { ...formDaVersao(versaoAtual(p)), comentario: 'Cliente confirmou as condições.' }, GESTOR)
    expect(versaoAtual(comComentario).oQueMudou).toBe('Sem alterações nas condições')
  })

  it('contraproposta é do responsável pela etapa e aguarda o cliente; a resposta reinicia o fluxo', async () => {
    const p = lerDb().propostas[0]
    const base = formDaVersao(versaoAtual(p))
    expect(await erroDe(criarNovaVersao(p.id, { ...base, descontoPercentual: '2' }, ADMIN, { contraproposta: true }))).toBe(
      'Somente o responsável pela etapa atual pode fazer uma contraproposta.',
    )

    const contra = await criarNovaVersao(p.id, { ...base, descontoPercentual: '2' }, GESTOR, { contraproposta: true })
    expect(contra.situacao).toBe('contraproposta')
    expect(versaoAtual(contra).situacao).toBe('contraproposta')
    expect(await erroDe(aprovarProposta(p.id, GESTOR))).toBe('Somente o responsável pela etapa atual pode decidir esta proposta.')

    const resposta = await criarNovaVersao(p.id, { ...formDaVersao(versaoAtual(contra)), comentario: 'Cliente aceitou.' }, { id: 'x', nome: 'Gustavo Marques' })
    expect(resposta.situacao).toBe('enviada')
    expect(resposta.versoes.map((v) => v.situacao).slice(-2)).toEqual(['substituida', 'em_analise'])
  })
})

describe('decisões (RF19, RF20, RF21)', () => {
  it('ao abrir, o responsável coloca a proposta enviada "Em análise" uma única vez', async () => {
    const p = porSituacao('enviada')
    await iniciarAnalise(p.id, ADMIN)
    await iniciarAnalise(p.id, ADMIN)
    expect(proposta(p.id).situacao).toBe('em_analise')
    expect(proposta(p.id).historico.filter((e) => e.tipo === 'analise')).toHaveLength(1)
  })

  it('aprova etapa por etapa até a aprovação final, que registra a venda', async () => {
    const enviada = await enviarProposta({ reservaId: reservaLivre().id, form: form({ descontoPercentual: '6', aprovadorId: 'usr-3' }) }, 'x')
    expect(await erroDe(aprovarProposta(enviada.id, ADMIN))).toBe('Somente o responsável pela etapa atual pode decidir esta proposta.')

    const etapa1 = await aprovarProposta(enviada.id, GERENTE)
    expect(etapa1.codigoVenda).toBeUndefined()
    expect(etapa1.proposta.situacao).toBe('aguardando_diretoria')
    expect(etapa1.proposta.etapas.map((e) => e.estado)).toEqual(['concluida', 'concluida', 'aguardando', 'pendente'])

    const vendas = lerDb().vendas.length
    const final = await aprovarProposta(enviada.id, ADMIN)
    expect(final.codigoVenda).toMatch(/^VD-\d{4}-\d{4}$/)
    expect(final.proposta.situacao).toBe('aprovada')
    expect(final.proposta.etapas.at(-1)).toMatchObject({ tipo: 'contrato', estado: 'pendente', automatica: true })
    expect(versaoAtual(final.proposta).situacao).toBe('aprovada')
    expect(lerDb().vendas).toHaveLength(vendas + 1)
    expect(lerDb().vendas.at(-1)?.valor).toBe(calcularCondicoes(versaoAtual(final.proposta).condicoes).valorProposto)
    // A venda nasce Em escritura, ligada à proposta, à reserva convertida e ao corretor, com o registro na auditoria.
    expect(lerDb().vendas.at(-1)).toMatchObject({ propostaId: enviada.id, reservaId: enviada.reservaId, corretorId: enviada.corretorId, status: 'em_escritura' })
    expect(lerDb().vendas.at(-1)?.historico).toEqual([expect.objectContaining({ tipo: 'registro', autor: 'Ayran Bade', statusAnterior: null })])
    expect(final.proposta.historico.map((e) => e.tipo).slice(-2)).toEqual(['aprovacao_etapa', 'aprovacao'])
  })

  it('recusa exige motivo e marca a etapa', async () => {
    const p = porSituacao('aguardando_diretoria')
    expect(await erroDe(recusarProposta(p.id, '  ', ADMIN))).toBe('Informe o motivo da recusa.')

    const recusada = await recusarProposta(p.id, 'Desconto acima da política', ADMIN)
    expect(recusada).toMatchObject({ situacao: 'recusada', motivoRecusa: 'Desconto acima da política' })
    expect(recusada.etapas.find((e) => e.tipo === 'diretoria')?.estado).toBe('recusada')
    expect(versaoAtual(recusada).situacao).toBe('recusada')
    expect(recusada.historico.at(-1)).toMatchObject({ tipo: 'recusa', autor: 'Ayran Bade', detalhe: 'Aprovação da diretoria: Desconto acima da política' })
  })

  it('proposta expirada não aceita decisões nem novas versões', async () => {
    const expirada = lerDb().propostas.find((p) => p.expiraEm && new Date(p.expiraEm).getTime() < Date.now() && p.situacao === 'enviada')!
    expect(await erroDe(aprovarProposta(expirada.id, GESTOR))).toBe('A proposta expirou e não aceita mais decisões.')
    expect(await erroDe(criarNovaVersao(expirada.id, { ...formDaVersao(versaoAtual(expirada)), comentario: 'x' }, GESTOR))).toBe(
      'A proposta expirou e não aceita novas versões.',
    )
  })
})
