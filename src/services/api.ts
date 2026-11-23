import { enviarArquivo } from './arquivos'
import { http } from './http'
import { idNaApi } from './quadras'
import { comSincronizacao } from './sincronizacao'
import { atualizarDb } from '../data/db'
import type {
  Db,
  Documento,
  EventoHistorico,
  Imovel,
  Quadra,
  Situacao,
  Usuario,
  UsuarioPublico,
} from '../data/types'
import { formatarMoedaInteira } from '../lib/format'

/**
 * Camada de serviço. Hoje grava no banco local (localStorage) com uma latência
 * simulada; quando o backend existir, basta trocar o corpo destas funções.
 */
const LATENCIA = import.meta.env.MODE === 'test' ? 0 : 450
export const esperar = (ms = LATENCIA) => new Promise((r) => setTimeout(r, ms))

// IDs aleatórios com o gerador criptográfico do navegador (não previsíveis).
export const novoId = (prefixo: string) => `${prefixo}-${crypto.randomUUID()}`

/** Dados do usuário sem a senha, para guardar na sessão. */
export function paraUsuarioPublico({ id, nome, email, papel }: Usuario): UsuarioPublico {
  return { id, nome, email, papel }
}

export const ROTULO_SITUACAO: Record<Situacao, EventoHistorico['situacao']> = {
  disponivel: { rotulo: 'Disponível', variante: 'normal' },
  reservado: { rotulo: 'Reservado', variante: 'atencao' },
  vendido: { rotulo: 'Vendido', variante: 'laranja' },
  bloqueado: { rotulo: 'Bloqueado', variante: 'escuro' },
}

/** Toda ação relevante vira um registro imutável no histórico do imóvel (RF32/RF33). */
export function comEvento(db: Db, e: Omit<EventoHistorico, 'id' | 'data'> & { data?: string }): Db {
  return {
    ...db,
    historico: [...db.historico, { id: novoId('his'), data: new Date().toISOString(), ...e }],
  }
}

export function acharImovel(db: Db, id: string) {
  const imovel = db.imoveis.find((i) => i.id === id)
  if (!imovel) throw new Error('Imóvel não encontrado.')
  return imovel
}

export function proximoCodigo(prefixo: string, existentes: string[]) {
  const ano = new Date().getFullYear()
  const maior = existentes
    .filter((c) => c.startsWith(`${prefixo}-${ano}-`))
    .reduce((m, c) => Math.max(m, Number(c.split('-').pop()) || 0), 0)
  return `${prefixo}-${ano}-${String(maior + 1).padStart(4, '0')}`
}

/** Sempre responde com sucesso para não revelar quais e-mails existem. */
export async function solicitarRecuperacaoSenha(email: string) {
  await http('/auth/recuperar-senha', { method: 'POST', body: { email: email.trim() } })
  return { email: email.trim() }
}

async function aprovarPropostaLocal(propostaId: string, autor = 'Administrador') {
  await esperar()
  const agora = new Date().toISOString()
  atualizarDb((db) => {
    const proposta = db.propostas.find((p) => p.id === propostaId)
    if (proposta?.status !== 'pendente') {
      throw new Error('Esta proposta já foi analisada.')
    }
    const { imovelId } = proposta
    if (!acharImovel(db, imovelId).matricula) {
      throw new Error('Este lote ainda está com a matrícula pendente e não pode ser vendido (RF06).')
    }
    const codigoVenda = proximoCodigo('VD', db.vendas.map((v) => v.codigo))
    const cliente = db.clientes.find((c) => c.id === proposta.clienteId)?.nome ?? 'cliente'
    const atualizado: Db = {
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
        i.id === imovelId
          ? { ...i, situacao: 'vendido', publicacao: { ...i.publicacao, catalogo: false }, atualizadoEm: agora }
          : i,
      ),
      vendas: [
        ...db.vendas,
        {
          id: novoId('ven'),
          codigo: codigoVenda,
          imovelId,
          clienteId: proposta.clienteId,
          propostaId,
          corretorId: proposta.corretorId,
          valor: proposta.valor,
          data: agora,
          status: 'ativa',
        },
      ],
    }
    return comEvento(atualizado, {
      imovelId,
      tipo: 'Venda',
      descricao: `Proposta ${proposta.codigo} aprovada; venda registrada para ${cliente}`,
      autor,
      referencia: codigoVenda,
      situacao: ROTULO_SITUACAO.vendido,
    })
  })
}

async function recusarPropostaLocal(propostaId: string, motivo: string, autor = 'Administrador') {
  await esperar()
  atualizarDb((db) => {
    const proposta = db.propostas.find((p) => p.id === propostaId)
    if (proposta?.status !== 'pendente') {
      throw new Error('Esta proposta já foi analisada.')
    }
    const atualizado: Db = {
      ...db,
      propostas: db.propostas.map((p) =>
        p.id === propostaId
          ? { ...p, status: 'recusada', decididaEm: new Date().toISOString(), motivoRecusa: motivo.trim() || undefined }
          : p,
      ),
      imoveis: db.imoveis.map((i) =>
        i.id === proposta.imovelId && i.situacao === 'reservado' ? { ...i, situacao: 'disponivel', atualizadoEm: new Date().toISOString() } : i,
      ),
    }
    return comEvento(atualizado, {
      imovelId: proposta.imovelId,
      tipo: 'Proposta',
      descricao: motivo.trim() ? `Proposta recusada: ${motivo.trim()}` : 'Proposta recusada',
      autor,
      referencia: proposta.codigo,
      situacao: { rotulo: 'Recusada', variante: 'critico' },
    })
  })
}

function descreverAlteracao(existente: Imovel | undefined, salvo: Imovel) {
  if (existente?.status !== 'publicado') return 'Imóvel publicado'
  if (existente.valores.tabela === salvo.valores.tabela) return 'Dados do imóvel atualizados'
  const de = formatarMoedaInteira(existente.valores.tabela ?? 0)
  const para = formatarMoedaInteira(salvo.valores.tabela ?? 0)
  return `Valor de tabela ajustado de ${de} para ${para}`
}

async function salvarImovelLocal(
  dados: Omit<Imovel, 'id' | 'criadoEm' | 'atualizadoEm'> & { id?: string },
  autor = 'Administrador',
) {
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
    const atualizado: Db = {
      ...db,
      imoveis: existente
        ? db.imoveis.map((i) => (i.id === salvo.id ? salvo : i))
        : [...db.imoveis, salvo],
    }
    if (salvo.status === 'rascunho' && existente?.status !== 'publicado') return atualizado
    return comEvento(atualizado, {
      imovelId: salvo.id,
      tipo: existente?.status === 'publicado' ? 'Alteração' : 'Cadastro',
      descricao: descreverAlteracao(existente, salvo),
      autor,
      situacao: ROTULO_SITUACAO[salvo.situacao],
    })
  })
  return salvo
}

async function excluirImovelLocal(id: string) {
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

// ===== Ações administrativas (RF24, RF25, RF26) =====

async function bloquearImovelLocal(
  id: string,
  dados: { motivo: string; justificativa: string; previsao?: string },
  autor: string,
) {
  await esperar()
  atualizarDb((db) => {
    const imovel = acharImovel(db, id)
    if (imovel.situacao !== 'disponivel') {
      throw new Error('Só é possível bloquear um imóvel disponível. Encerre a reserva ou a venda antes.')
    }
    const agora = new Date().toISOString()
    const atualizado: Db = {
      ...db,
      imoveis: db.imoveis.map((i) =>
        i.id === id
          ? {
              ...i,
              situacao: 'bloqueado',
              bloqueio: { ...dados, justificativa: dados.justificativa.trim(), em: agora },
              publicacao: { ...i.publicacao, catalogo: false },
              atualizadoEm: agora,
            }
          : i,
      ),
    }
    return comEvento(atualizado, {
      imovelId: id,
      tipo: 'Bloqueio',
      descricao: `Bloqueado: ${dados.motivo.toLowerCase()} — ${dados.justificativa.trim()}`,
      autor,
      situacao: ROTULO_SITUACAO.bloqueado,
    })
  })
}

async function reabilitarImovelLocal(id: string, dados: { documento: string; observacao: string }, autor: string) {
  await esperar()
  atualizarDb((db) => {
    const imovel = acharImovel(db, id)
    if (imovel.situacao !== 'bloqueado') throw new Error('Só imóveis bloqueados podem ser reabilitados.')
    const agora = new Date().toISOString()
    const atualizado: Db = {
      ...db,
      imoveis: db.imoveis.map((i) =>
        i.id === id ? { ...i, situacao: 'disponivel', bloqueio: undefined, atualizadoEm: agora } : i,
      ),
    }
    return comEvento(atualizado, {
      imovelId: id,
      tipo: 'Reabilitação',
      descricao: dados.observacao.trim() || 'Imóvel liberado para venda',
      autor,
      referencia: dados.documento.trim() || undefined,
      situacao: ROTULO_SITUACAO.disponivel,
    })
  })
}

async function cancelarVendaLocal(
  vendaId: string,
  dados: { motivo: string; dataDistrato: string; devolucao: number },
  autor: string,
) {
  await esperar()
  atualizarDb((db) => {
    const venda = db.vendas.find((v) => v.id === vendaId)
    if (venda?.status !== 'ativa') throw new Error('Venda não encontrada ou já cancelada.')
    const agora = new Date().toISOString()
    const atualizado: Db = {
      ...db,
      vendas: db.vendas.map((v) =>
        v.id === vendaId ? { ...v, status: 'cancelada', cancelamento: { ...dados, em: agora } } : v,
      ),
      // RF24: o imóvel só volta ao estoque depois da reabilitação.
      imoveis: db.imoveis.map((i) =>
        i.id === venda.imovelId
          ? {
              ...i,
              situacao: 'bloqueado',
              bloqueio: { motivo: 'Venda cancelada', justificativa: dados.motivo, em: agora },
              atualizadoEm: agora,
            }
          : i,
      ),
    }
    return comEvento(atualizado, {
      imovelId: venda.imovelId,
      tipo: 'Cancelamento',
      descricao: `Venda cancelada (${dados.motivo.toLowerCase()}); devolução de ${formatarMoedaInteira(dados.devolucao)}`,
      autor,
      referencia: venda.codigo,
      situacao: ROTULO_SITUACAO.bloqueado,
    })
  })
}

// ===== Documentos (RF07) =====

/** Arquivos até este tamanho ficam guardados para download na demonstração. */

async function enviarDocumentoLocal(
  imovelId: string,
  dados: { tipo: string; arquivo: File; validade?: string; visivelCatalogo: boolean },
  autor: string,
) {
  const conteudo = await enviarArquivo(dados.arquivo, dados.arquivo.name)
  let versao = 1
  atualizarDb((db) => {
    // Mesmo tipo = nova versão; a anterior fica no histórico, nunca é apagada.
    const anteriores = db.documentos.filter((d) => d.imovelId === imovelId && d.tipo === dados.tipo)
    versao = anteriores.reduce((m, d) => Math.max(m, d.versao), 0) + 1
    const novo: Documento = {
      id: novoId('doc'),
      imovelId,
      tipo: dados.tipo,
      arquivo: dados.arquivo.name,
      tamanho: dados.arquivo.size,
      versao,
      enviadoPor: autor,
      data: new Date().toISOString(),
      validade: dados.validade || undefined,
      visivelCatalogo: dados.visivelCatalogo,
      substituido: false,
      conteudo,
    }
    const atualizado: Db = {
      ...db,
      documentos: [
        ...db.documentos.map((d) =>
          d.imovelId === imovelId && d.tipo === dados.tipo ? { ...d, substituido: true } : d,
        ),
        novo,
      ],
    }
    const imovel = acharImovel(db, imovelId)
    return comEvento(atualizado, {
      imovelId,
      tipo: 'Documento',
      descricao: `${dados.tipo} enviado (v${versao})`,
      autor,
      referencia: dados.arquivo.name,
      situacao: ROTULO_SITUACAO[imovel.situacao],
    })
  })
  return versao
}

// ===== Catálogo público =====

/** Vai direto para a rota pública: quem envia é o visitante, sem login. */
export async function registrarInteresse(
  imovelId: string,
  dados: { nome: string; email: string; telefone: string; mensagem: string },
) {
  const { codigo } = await http<{ codigo: string }>('/publico/interesses', {
    method: 'POST',
    body: { idLote: idNaApi(imovelId), ...dados },
  })
  return codigo
}

// ===== Loteamentos e quadras (RF03, RF04, RF05) =====

export interface LotePrevia {
  lote: string
  area: number
  testada: number
  valor: number
  situacao: Situacao
  observacao: string
}

async function gerarQuadraLocal(
  quadra: Omit<Quadra, 'id' | 'criadaEm'>,
  lotes: LotePrevia[],
  autor: string,
  salva?: Pick<Quadra, 'id' | 'criadaEm'>,
) {
  if (!salva) await esperar()
  let criados = 0
  atualizarDb((db) => {
    const loteamento = db.loteamentos.find((l) => l.nome === quadra.loteamento)
    if (!loteamento) throw new Error('Loteamento não encontrado.')
    const identificacao = quadra.identificacao.trim()
    if (!salva && db.quadras.some((q) => q.loteamento === quadra.loteamento && q.identificacao === identificacao)) {
      throw new Error(`A Qd. ${identificacao} já existe em ${quadra.loteamento}.`)
    }
    const agora = new Date().toISOString()
    let codigo = db.imoveis.reduce((m, i) => Math.max(m, Number(i.codigo) || 0), 0)
    const centro = loteamento.centro ?? { lat: -24.7246, lng: -53.7412 }
    const novos: Imovel[] = lotes.map((l, idx) => {
      codigo += 1
      return {
        id: novoId('imo'),
        codigo: String(codigo),
        titulo: `Terreno ${l.area.toLocaleString('pt-BR')}m² — ${loteamento.nome}`,
        // RF06: matrícula própria fica pendente até o registro; não pode ser vendido.
        matricula: '',
        tipo: 'Terreno em loteamento',
        loteamento: loteamento.nome,
        situacao: l.situacao,
        endereco: {
          cep: loteamento.cep,
          logradouro: quadra.testadaPara,
          numero: 's/n',
          bairro: loteamento.bairro,
          cidade: loteamento.cidade,
          uf: loteamento.uf,
          quadra: identificacao,
          lote: l.lote,
        },
        geo: { lat: +(centro.lat - 0.0012).toFixed(6), lng: +(centro.lng + (idx - lotes.length / 2) * 0.00035).toFixed(6) },
        dimensoes: {
          areaTotal: l.area,
          frente: l.testada || null,
          fundo: l.testada ? Math.round((l.area / l.testada) * 100) / 100 : null,
          topografia: 'Plano',
        },
        valores: { tabela: l.valor, minimo: Math.round((l.valor * 0.92) / 500) * 500, prazoReservaHoras: 72 },
        publicacao: { catalogo: false, reservasOnline: true, destaque: false },
        fotos: [],
        observacao: l.observacao.trim() || undefined,
        bloqueio:
          l.situacao === 'bloqueado'
            ? { motivo: 'Outro', justificativa: l.observacao.trim() || 'Bloqueado na geração da quadra.', em: agora }
            : undefined,
        status: 'publicado',
        criadoEm: agora,
        atualizadoEm: agora,
      }
    })
    criados = novos.length
    let atualizado: Db = {
      ...db,
      quadras: [
        ...db.quadras.filter((q) => q.id !== salva?.id),
        { ...quadra, identificacao, id: salva?.id ?? novoId('qua'), criadaEm: salva?.criadaEm ?? agora },
      ],
      imoveis: [...db.imoveis, ...novos],
    }
    for (const n of novos) {
      atualizado = comEvento(atualizado, {
        imovelId: n.id,
        tipo: 'Cadastro',
        descricao: `Lote criado na geração da Qd. ${identificacao}`,
        autor,
        referencia: loteamento.codigo,
        situacao: ROTULO_SITUACAO[n.situacao],
      })
    }
    return atualizado
  })
  return criados
}

// ===== Importação de planilha =====

async function importarImoveisLocal(
  itens: Omit<Imovel, 'id' | 'codigo' | 'criadoEm' | 'atualizadoEm'>[],
  autor: string,
) {
  await esperar()
  atualizarDb((db) => {
    const agora = new Date().toISOString()
    let codigo = db.imoveis.reduce((m, i) => Math.max(m, Number(i.codigo) || 0), 0)
    const novos: Imovel[] = itens.map((item) => ({
      ...item,
      id: novoId('imo'),
      codigo: String(++codigo),
      criadoEm: agora,
      atualizadoEm: agora,
    }))
    let atualizado: Db = { ...db, imoveis: [...db.imoveis, ...novos] }
    // Quadras novas citadas na planilha passam a existir no loteamento.
    for (const n of novos) {
      if (!atualizado.quadras.some((q) => q.loteamento === n.loteamento && q.identificacao === n.endereco.quadra)) {
        atualizado = {
          ...atualizado,
          quadras: [
            ...atualizado.quadras,
            { id: novoId('qua'), loteamento: n.loteamento, identificacao: n.endereco.quadra, area: null, testadaPara: '', criadaEm: agora },
          ],
        }
      }
      atualizado = comEvento(atualizado, {
        imovelId: n.id,
        tipo: 'Cadastro',
        descricao: 'Lote importado por planilha',
        autor,
        situacao: ROTULO_SITUACAO[n.situacao],
      })
    }
    return atualizado
  })
  return itens.length
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

// Operações que mexem no banco: rodam localmente e enviam a diferença para a API.
export const sincronizada =
  <A extends unknown[], R>(fn: (...args: A) => Promise<R> | R) =>
  (...args: A) =>
    comSincronizacao(() => fn(...args))

export const salvarImovel = sincronizada(salvarImovelLocal)
export const excluirImovel = sincronizada(excluirImovelLocal)
export const bloquearImovel = sincronizada(bloquearImovelLocal)
export const reabilitarImovel = sincronizada(reabilitarImovelLocal)
export const importarImoveis = sincronizada(importarImoveisLocal)
export const gerarQuadra = sincronizada(gerarQuadraLocal)
export const aprovarProposta = sincronizada(aprovarPropostaLocal)
export const cancelarVenda = sincronizada(cancelarVendaLocal)
export const recusarProposta = sincronizada(recusarPropostaLocal)
export const enviarDocumento = sincronizada(enviarDocumentoLocal)
