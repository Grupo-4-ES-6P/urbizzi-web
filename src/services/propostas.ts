import { atualizarDb } from '../data/db'
import { reservaAtiva } from '../data/selectors'
import type { Db, EtapaAprovacao, EventoProposta, Proposta, Usuario, VersaoProposta } from '../data/types'
import { formatarMoedaInteira } from '../lib/format'
import {
  acimaDaAlcada,
  calcularCondicoes,
  condicoesDoForm,
  CONFIG_PROPOSTAS,
  descreverMudancas,
  emAndamento,
  etapaAtual,
  exigeDiretoria,
  formatarParcelas,
  formatarPercentual,
  instanteExpiracaoProposta,
  montarEtapas,
  propostaAberta,
  situacaoDaEtapa,
  situacaoProposta,
  validarProposta,
  versaoAtual,
  type FormProposta,
} from '../lib/propostas'
import { podeDecidirProposta } from '../lib/permissoes'
import { dataCalendario } from '../lib/reservas'
import { acharImovel, comEvento, esperar, eventoReserva, novoId, proximoCodigo, ROTULO_SITUACAO } from './api'
import { eventoVenda } from './vendas'

/**
 * Serviço de propostas (RF17–RF21, RF32). Grava no banco local como o restante
 * de `services/api.ts`; com o backend, só o corpo destas funções muda.
 */

export interface UsuarioAcao {
  id: string
  nome: string
}

export interface DadosProposta {
  reservaId: string
  /** Presente ao continuar um rascunho já salvo. */
  propostaId?: string
  form: FormProposta
}

const EM_ANALISE_IMOVEL = { rotulo: 'Em análise', variante: 'escuro' } as const

function acharProposta(db: Db, id: string) {
  const proposta = db.propostas.find((p) => p.id === id)
  if (!proposta) throw new Error('Proposta não encontrada.')
  return proposta
}

function comProposta(db: Db, atualizada: Proposta): Db {
  return { ...db, propostas: db.propostas.map((p) => (p.id === atualizada.id ? atualizada : p)) }
}

function evento(tipo: EventoProposta['tipo'], dados: Omit<EventoProposta, 'id' | 'tipo'>): EventoProposta {
  return { id: novoId('evp'), tipo, ...dados }
}

function responsavel(db: Db, id: string) {
  const u: Usuario | undefined = db.usuarios.find((x) => x.id === id)
  if (!u) throw new Error('Aprovador não encontrado.')
  return { id: u.id, nome: u.nome, cargo: u.papel }
}

/** Resumo das condições exatas de uma versão, gravado na trilha de auditoria (RF32). */
function resumoCondicoes(v: VersaoProposta) {
  const c = v.condicoes
  const k = calcularCondicoes(c)
  return [
    `v${v.numero}`,
    formatarMoedaInteira(k.valorProposto),
    `desconto ${formatarPercentual(c.descontoPercentual)}${v.acimaDaAlcada ? ' (acima da alçada)' : ''}`,
    `entrada ${formatarMoedaInteira(c.entrada)}`,
    formatarParcelas(c.parcelas, k.valorParcela),
    c.indiceCorrecao,
  ].join(' · ')
}

/** RF17: proposta só nasce de reserva ativa, e uma reserva tem no máximo uma proposta aberta. */
function validarReserva(db: Db, reservaId: string, propostaId: string | undefined, agora: number) {
  const reserva = db.reservas.find((r) => r.id === reservaId)
  if (!reserva) throw new Error('Reserva não encontrada.')
  if (!reservaAtiva(reserva, agora)) throw new Error('Propostas só podem ser geradas a partir de uma reserva ativa (RF17).')
  const aberta = propostaAberta(db.propostas, reservaId, agora, propostaId)
  if (aberta) throw new Error(`A reserva ${reserva.codigo} já tem a proposta ${aberta.codigo} em andamento.`)
  return reserva
}

function validarForm(form: FormProposta, imovelTabela: number, minimo: number | null, envio: boolean) {
  const erros = validarProposta(form, { valorTabela: imovelTabela, minimo, hoje: dataCalendario(new Date()), envio })
  const primeiro = Object.values(erros)[0]
  if (primeiro) throw new Error(primeiro)
}

/** Etapas do fluxo para a versão enviada: o aprovador escolhido faz a análise comercial. */
function etapasDaVersao(db: Db, v: VersaoProposta, autor: string, enviadaEm: string): EtapaAprovacao[] {
  const aprovador = responsavel(db, v.aprovadorId || CONFIG_PROPOSTAS.gestorPadraoUsuarioId)
  const precisaDiretoria =
    exigeDiretoria(v.condicoes.descontoPercentual) && aprovador.id !== CONFIG_PROPOSTAS.diretoriaUsuarioId
  return montarEtapas({
    autor,
    enviadaEm,
    aprovador,
    diretoria: precisaDiretoria ? responsavel(db, CONFIG_PROPOSTAS.diretoriaUsuarioId) : undefined,
  })
}

async function gravarProposta(dados: DadosProposta, autor: string, envio: boolean) {
  await esperar()
  let salva!: Proposta
  atualizarDb((db) => {
    const agoraMs = Date.now()
    const agora = new Date(agoraMs).toISOString()
    const reserva = validarReserva(db, dados.reservaId, dados.propostaId, agoraMs)
    const imovel = acharImovel(db, reserva.imovelId)
    const tabela = imovel.valores.tabela
    if (!tabela) throw new Error('O imóvel não tem valor de tabela cadastrado.')
    validarForm(dados.form, tabela, imovel.valores.minimo, envio)

    const existente = dados.propostaId ? acharProposta(db, dados.propostaId) : undefined
    if (existente && existente.situacao !== 'rascunho') {
      throw new Error('Esta proposta já foi enviada; registre uma nova versão.')
    }
    const condicoes = condicoesDoForm(dados.form, tabela)
    const versao: VersaoProposta = {
      numero: 1,
      criadaEm: existente?.versoes[0].criadaEm ?? agora,
      autor,
      enviadaEm: envio ? agora : undefined,
      condicoes,
      acimaDaAlcada: acimaDaAlcada(condicoes.descontoPercentual),
      aprovadorId: dados.form.aprovadorId,
      observacoes: dados.form.observacoes.trim(),
      anexos: dados.form.anexos,
      oQueMudou: descreverMudancas(undefined, condicoes),
      comentario: dados.form.comentario.trim(),
      situacao: envio ? 'em_analise' : 'rascunho',
    }
    const base: Proposta = existente ?? {
      id: novoId('pro'),
      codigo: proximoCodigo('PROP', db.propostas.map((p) => p.codigo)),
      reservaId: reserva.id,
      imovelId: reserva.imovelId,
      clienteId: reserva.clienteId,
      corretorId: reserva.corretorId,
      situacao: 'rascunho',
      criadaEm: agora,
      atualizadaEm: agora,
      versoes: [],
      etapas: [],
      historico: [evento('criacao', { data: agora, titulo: 'Proposta criada', autor, detalhe: `A partir da reserva ${reserva.codigo}`, versao: 1 })],
    }
    salva = {
      ...base,
      // Rascunho ainda não foi enviado, então pode ser substituído; versões enviadas nunca são.
      versoes: [versao],
      situacao: envio ? 'enviada' : 'rascunho',
      atualizadaEm: agora,
      expiraEm: envio ? instanteExpiracaoProposta(dataCalendario(new Date(agoraMs)), condicoes.validadeDias) : undefined,
      etapas: envio ? etapasDaVersao(db, versao, autor, agora) : [],
      historico: [
        ...base.historico,
        envio
          ? evento('envio', { data: agora, titulo: 'Enviada para aprovação', autor, detalhe: resumoCondicoes(versao), versao: 1 })
          : evento('rascunho', { data: agora, titulo: 'Rascunho salvo', autor, detalhe: resumoCondicoes(versao), versao: 1 }),
      ],
    }
    const atualizado = existente ? comProposta(db, salva) : { ...db, propostas: [...db.propostas, salva] }
    if (!envio) return atualizado
    return comEvento(atualizado, {
      imovelId: imovel.id,
      tipo: 'Proposta',
      descricao: 'Proposta enviada para aprovação',
      autor,
      referencia: salva.codigo,
      situacao: EM_ANALISE_IMOVEL,
    })
  })
  return salva
}

/** Salva sem enviar: só o formato dos campos é verificado. */
export function salvarRascunhoProposta(dados: DadosProposta, autor: string) {
  return gravarProposta(dados, autor, false)
}

/** Valida tudo, inicia o fluxo de aprovação e registra a auditoria do envio (RF32). */
export function enviarProposta(dados: DadosProposta, autor: string) {
  return gravarProposta(dados, autor, true)
}

/**
 * Cria a versão N+1 a partir da vigente (RF18). A anterior passa a "Substituída" e
 * suas condições nunca são alteradas. Na contraproposta, quem decide a etapa propõe
 * novas condições ao cliente e o fluxo aguarda a resposta dele.
 */
export async function criarNovaVersao(
  propostaId: string,
  form: FormProposta,
  usuario: UsuarioAcao,
  { contraproposta = false } = {},
) {
  await esperar()
  let salva!: Proposta
  atualizarDb((db) => {
    const agoraMs = Date.now()
    const agora = new Date(agoraMs).toISOString()
    const proposta = acharProposta(db, propostaId)
    const situacao = situacaoProposta(proposta, agoraMs)
    if (situacao === 'expirada') throw new Error('A proposta expirou e não aceita novas versões.')
    if (contraproposta ? !decide(db, proposta, usuario, agoraMs) : !emAndamento(situacao)) {
      throw new Error(
        contraproposta
          ? 'Somente o responsável pela etapa atual pode fazer uma contraproposta.'
          : 'Só é possível criar versões de propostas em negociação.',
      )
    }
    const imovel = acharImovel(db, proposta.imovelId)
    const anterior = versaoAtual(proposta)
    validarForm(form, anterior.condicoes.valorTabela, imovel.valores.minimo, true)

    const condicoes = condicoesDoForm(form, anterior.condicoes.valorTabela, anterior)
    const oQueMudou = descreverMudancas(anterior.condicoes, condicoes)
    const comentario = form.comentario.trim()
    if (oQueMudou === 'Sem alterações nas condições' && !comentario) {
      throw new Error('Altere alguma condição ou explique a nova versão no comentário.')
    }
    const nova: VersaoProposta = {
      numero: anterior.numero + 1,
      criadaEm: agora,
      autor: usuario.nome,
      enviadaEm: agora,
      condicoes,
      acimaDaAlcada: acimaDaAlcada(condicoes.descontoPercentual),
      aprovadorId: form.aprovadorId,
      observacoes: form.observacoes.trim(),
      anexos: form.anexos,
      oQueMudou,
      comentario,
      situacao: contraproposta ? 'contraproposta' : 'em_analise',
    }
    const detalhe = `v${nova.numero} · ${oQueMudou}${comentario ? ` · "${comentario}"` : ''}`
    salva = {
      ...proposta,
      versoes: [
        ...proposta.versoes.map((v) => (v.numero === anterior.numero ? { ...v, situacao: 'substituida' as const } : v)),
        nova,
      ],
      situacao: contraproposta ? 'contraproposta' : 'enviada',
      atualizadaEm: agora,
      expiraEm: instanteExpiracaoProposta(dataCalendario(new Date(agoraMs)), condicoes.validadeDias),
      // A resposta do cliente a uma contraproposta reinicia o fluxo de aprovação.
      etapas: contraproposta ? proposta.etapas : etapasDaVersao(db, nova, usuario.nome, agora),
      historico: [
        ...proposta.historico,
        contraproposta
          ? evento('contraproposta', { data: agora, titulo: 'Contraproposta', autor: usuario.nome, detalhe, versao: nova.numero })
          : evento('nova_versao', { data: agora, titulo: 'Nova versão enviada', autor: usuario.nome, detalhe, versao: nova.numero }),
      ],
    }
    return comEvento(comProposta(db, salva), {
      imovelId: proposta.imovelId,
      tipo: 'Proposta',
      descricao: contraproposta ? `Contraproposta v${nova.numero} enviada ao cliente` : `Nova versão v${nova.numero} enviada para aprovação`,
      autor: usuario.nome,
      referencia: proposta.codigo,
      situacao: EM_ANALISE_IMOVEL,
    })
  })
  return salva
}

/** Quando o responsável pela análise comercial abre a proposta enviada, ela passa a "Em análise". */
export async function iniciarAnalise(propostaId: string, usuario: UsuarioAcao) {
  await esperar(0)
  atualizarDb((db) => {
    const proposta = acharProposta(db, propostaId)
    const etapa = etapaAtual(proposta)
    const agoraMs = Date.now()
    if (
      situacaoProposta(proposta, agoraMs) !== 'enviada' ||
      etapa?.tipo !== 'analise_comercial' ||
      !decide(db, proposta, usuario, agoraMs)
    ) {
      return db
    }
    const agora = new Date(agoraMs).toISOString()
    return comProposta(db, {
      ...proposta,
      situacao: 'em_analise',
      atualizadaEm: agora,
      historico: [
        ...proposta.historico,
        evento('analise', { data: agora, titulo: 'Em análise', autor: usuario.nome, detalhe: 'Análise comercial iniciada', versao: versaoAtual(proposta).numero }),
      ],
    })
  })
}

/** Responsável pela etapa e com a permissão dela; o perfil é relido do cadastro. */
function decide(db: Db, proposta: Proposta, usuario: UsuarioAcao, agoraMs: number) {
  const cadastro = db.usuarios.find((u) => u.id === usuario.id && u.ativo)
  return podeDecidirProposta(proposta, cadastro, agoraMs, db.permissoes)
}

function exigirDecisao(db: Db, proposta: Proposta, usuario: UsuarioAcao, agoraMs: number) {
  if (situacaoProposta(proposta, agoraMs) === 'expirada') throw new Error('A proposta expirou e não aceita mais decisões.')
  if (!decide(db, proposta, usuario, agoraMs)) {
    throw new Error('Somente o responsável pela etapa atual pode decidir esta proposta.')
  }
  return etapaAtual(proposta)!
}

/**
 * Aprova a etapa atual. Se ainda houver etapa de decisão, a proposta avança;
 * na última, fica Aprovada, a venda é registrada e "Contrato gerado" fica pendente (automático).
 */
export async function aprovarProposta(propostaId: string, usuario: UsuarioAcao) {
  await esperar()
  let salva!: Proposta
  let codigoVenda: string | undefined
  atualizarDb((db) => {
    const agoraMs = Date.now()
    const agora = new Date(agoraMs).toISOString()
    const proposta = acharProposta(db, propostaId)
    const etapa = exigirDecisao(db, proposta, usuario, agoraMs)
    const indice = proposta.etapas.indexOf(etapa)
    const proxima = proposta.etapas[indice + 1]
    const final = !proxima || proxima.automatica
    const atual = versaoAtual(proposta)

    const etapas = proposta.etapas.map((e, i) => {
      if (i === indice) return { ...e, estado: 'concluida' as const, concluidaEm: agora, responsavelNome: usuario.nome }
      if (i === indice + 1 && !final) return { ...e, estado: 'aguardando' as const }
      return e
    })

    if (!final) {
      salva = {
        ...proposta,
        etapas,
        situacao: situacaoDaEtapa(proxima.tipo),
        atualizadaEm: agora,
        historico: [
          ...proposta.historico,
          evento('aprovacao_etapa', {
            data: agora,
            titulo: `${etapa.titulo} aprovada`,
            autor: usuario.nome,
            detalhe: `Encaminhada para ${proxima.titulo.toLowerCase()}`,
            versao: atual.numero,
          }),
        ],
      }
      return comProposta(db, salva)
    }

    const imovel = acharImovel(db, proposta.imovelId)
    if (!imovel.matricula) throw new Error('Este lote ainda está com a matrícula pendente e não pode ser vendido (RF06).')
    const valor = calcularCondicoes(atual.condicoes).valorProposto
    codigoVenda = proximoCodigo('VD', db.vendas.map((v) => v.codigo))
    const cliente = db.clientes.find((c) => c.id === proposta.clienteId)?.nome ?? 'cliente'
    salva = {
      ...proposta,
      etapas,
      situacao: 'aprovada',
      decididaEm: agora,
      atualizadaEm: agora,
      versoes: proposta.versoes.map((v) => (v.numero === atual.numero ? { ...v, situacao: 'aprovada' as const } : v)),
      historico: [
        ...proposta.historico,
        evento('aprovacao', {
          data: agora,
          titulo: 'Proposta aprovada',
          autor: usuario.nome,
          detalhe: `v${atual.numero} · ${formatarMoedaInteira(valor)} · venda ${codigoVenda} registrada; contrato será gerado automaticamente`,
          versao: atual.numero,
        }),
      ],
    }
    const venda = codigoVenda
    const atualizado: Db = {
      ...db,
      // Aprovar uma proposta encerra as concorrentes do mesmo imóvel.
      propostas: db.propostas.map((p) => {
        if (p.id === propostaId) return salva
        if (p.imovelId === proposta.imovelId && emAndamento(situacaoProposta(p, agoraMs))) {
          return { ...p, situacao: 'recusada', decididaEm: agora, motivoRecusa: 'Outra proposta foi aprovada.' }
        }
        return p
      }),
      reservas: db.reservas.map((r) =>
        r.imovelId === proposta.imovelId && r.status === 'ativa'
          ? {
              ...r,
              status: 'convertida',
              atualizadaEm: agora,
              historico: [
                ...r.historico,
                eventoReserva('conversao', agora, {
                  titulo: 'Reserva convertida em venda',
                  autor: usuario.nome,
                  detalhe: `Proposta ${proposta.codigo} aprovada · venda ${venda}`,
                  situacao: 'convertida',
                }),
              ],
            }
          : r,
      ),
      imoveis: db.imoveis.map((i) =>
        i.id === proposta.imovelId
          ? { ...i, situacao: 'vendido', publicacao: { ...i.publicacao, catalogo: false }, atualizadoEm: agora }
          : i,
      ),
      vendas: [
        ...db.vendas,
        {
          id: novoId('ven'),
          codigo: venda,
          imovelId: proposta.imovelId,
          clienteId: proposta.clienteId,
          corretorId: proposta.corretorId,
          propostaId,
          reservaId: proposta.reservaId,
          valor,
          data: agora,
          status: 'em_escritura',
          historico: [
            eventoVenda('registro', agora, {
              autor: usuario.nome,
              statusAnterior: null,
              status: 'em_escritura',
              detalhe: `Proposta ${proposta.codigo} aprovada · ${formatarMoedaInteira(valor)}`,
            }),
          ],
        },
      ],
    }
    return comEvento(atualizado, {
      imovelId: proposta.imovelId,
      tipo: 'Venda',
      descricao: `Proposta ${proposta.codigo} aprovada; venda registrada para ${cliente}`,
      autor: usuario.nome,
      referencia: venda,
      situacao: ROTULO_SITUACAO.vendido,
    })
  })
  return { proposta: salva, codigoVenda }
}

/** Recusa exige motivo; a etapa atual fica marcada como recusada. */
export async function recusarProposta(propostaId: string, motivo: string, usuario: UsuarioAcao) {
  await esperar()
  const texto = motivo.trim()
  if (!texto) throw new Error('Informe o motivo da recusa.')
  let salva!: Proposta
  atualizarDb((db) => {
    const agoraMs = Date.now()
    const agora = new Date(agoraMs).toISOString()
    const proposta = acharProposta(db, propostaId)
    const etapa = exigirDecisao(db, proposta, usuario, agoraMs)
    const atual = versaoAtual(proposta)
    salva = {
      ...proposta,
      situacao: 'recusada',
      decididaEm: agora,
      atualizadaEm: agora,
      motivoRecusa: texto,
      etapas: proposta.etapas.map((e) =>
        e === etapa ? { ...e, estado: 'recusada' as const, concluidaEm: agora, responsavelNome: usuario.nome } : e,
      ),
      versoes: proposta.versoes.map((v) => (v.numero === atual.numero ? { ...v, situacao: 'recusada' as const } : v)),
      historico: [
        ...proposta.historico,
        evento('recusa', { data: agora, titulo: 'Proposta recusada', autor: usuario.nome, detalhe: `${etapa.titulo}: ${texto}`, versao: atual.numero }),
      ],
    }
    return comEvento(comProposta(db, salva), {
      imovelId: proposta.imovelId,
      tipo: 'Proposta',
      descricao: `Proposta recusada: ${texto}`,
      autor: usuario.nome,
      referencia: proposta.codigo,
      situacao: { rotulo: 'Recusada', variante: 'critico' },
    })
  })
  return salva
}
