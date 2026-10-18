import { atualizarDb } from '../data/db'
import type { CancelamentoVenda, Db, EventoVenda, StatusVenda, Venda } from '../data/types'
import { formatarMoedaInteira } from '../lib/format'
import { dataCalendarioValida } from '../lib/reservas'
import {
  hojeCalendario,
  impedimentoVenda,
  instanteDaVenda,
  podeCancelar,
  podeCancelarVenda,
  podeConcluir,
  podeConcluirEscritura,
  STATUS_VENDA,
  validarJustificativa,
} from '../lib/vendas'
import { acharImovel, comEvento, esperar, eventoReserva, novoId, proximoCodigo, ROTULO_SITUACAO } from './api'

/**
 * Serviço de vendas (RF24, RF32). Grava no banco local como o restante de
 * `services/api.ts`; com o backend, só o corpo destas funções muda.
 */

/** `papel` vazio (sessão ausente) nunca tem permissão. */
export interface UsuarioVenda {
  nome: string
  papel: string
}

export function eventoVenda(
  tipo: EventoVenda['tipo'],
  data: string,
  dados: Pick<EventoVenda, 'autor' | 'statusAnterior' | 'status' | 'detalhe'>,
): EventoVenda {
  return { id: novoId('evv'), tipo, data, ...dados }
}

function acharVenda(db: Db, id: string) {
  const venda = db.vendas.find((v) => v.id === id)
  if (!venda) throw new Error('Venda não encontrada.')
  return venda
}

function exigirPermissao(permitido: boolean) {
  if (!permitido) throw new Error('Seu perfil não tem permissão para alterar vendas.')
}

/** A auditoria só cresce: o evento novo entra no fim e os anteriores nunca mudam. */
function comVenda(db: Db, venda: Venda, alteracoes: Partial<Venda>, e: EventoVenda): Db {
  const atualizada: Venda = { ...venda, ...alteracoes, historico: [...venda.historico, e] }
  return { ...db, vendas: db.vendas.map((v) => (v.id === venda.id ? atualizada : v)) }
}

export interface DadosVenda {
  imovelId: string
  clienteId: string
  corretorId: string
  valor: number
  /** YYYY-MM-DD */
  data: string
  status: Exclude<StatusVenda, 'cancelada'>
}

/** Registro manual: o imóvel passa a Vendido e a reserva ativa do comprador é convertida. */
export async function registrarVenda(dados: DadosVenda, usuario: UsuarioVenda) {
  await esperar()
  let criada!: Venda
  atualizarDb((db) => {
    const agoraMs = Date.now()
    const agora = new Date(agoraMs).toISOString()
    const impedimento = impedimentoVenda(db, dados.imovelId, dados.clienteId, agoraMs)
    if (impedimento) throw new Error(impedimento)
    const cliente = db.clientes.find((c) => c.id === dados.clienteId)
    if (!cliente) throw new Error('Comprador não encontrado.')
    if (!cliente.ativo) throw new Error('Este cliente está inativo. Reative o cadastro para registrar a venda.')
    const corretor = db.usuarios.find((u) => u.id === dados.corretorId)
    if (!corretor) throw new Error('Corretor não encontrado.')
    if (!corretor.ativo) throw new Error('Este corretor está inativo. Escolha outro responsável.')
    if (!Number.isFinite(dados.valor) || dados.valor <= 0) throw new Error('Informe um valor maior que zero.')
    if (!dataCalendarioValida(dados.data) || dados.data > hojeCalendario()) {
      throw new Error('A data da venda precisa ser válida e não pode estar no futuro.')
    }
    if (dados.status !== 'em_escritura' && dados.status !== 'concluida') throw new Error('Status inicial inválido.')

    const codigo = proximoCodigo('VD', db.vendas.map((v) => v.codigo))
    const reserva = db.reservas.find(
      (r) => r.imovelId === dados.imovelId && r.clienteId === dados.clienteId && r.status === 'ativa',
    )
    criada = {
      id: novoId('ven'),
      codigo,
      imovelId: dados.imovelId,
      clienteId: dados.clienteId,
      corretorId: dados.corretorId,
      reservaId: reserva?.id,
      valor: dados.valor,
      data: instanteDaVenda(dados.data),
      status: dados.status,
      historico: [
        eventoVenda('registro', agora, {
          autor: usuario.nome,
          statusAnterior: null,
          status: dados.status,
          detalhe: `Registro manual · ${formatarMoedaInteira(dados.valor)}${reserva ? ` · reserva ${reserva.codigo} convertida` : ''}`,
        }),
      ],
    }
    const atualizado: Db = {
      ...db,
      vendas: [...db.vendas, criada],
      imoveis: db.imoveis.map((i) =>
        i.id === dados.imovelId
          ? { ...i, situacao: 'vendido', publicacao: { ...i.publicacao, catalogo: false }, atualizadoEm: agora }
          : i,
      ),
      reservas: db.reservas.map((r) =>
        r.id === reserva?.id
          ? {
              ...r,
              status: 'convertida',
              atualizadaEm: agora,
              historico: [
                ...r.historico,
                eventoReserva('conversao', agora, {
                  titulo: 'Reserva convertida em venda',
                  autor: usuario.nome,
                  detalhe: `Venda ${codigo} registrada manualmente`,
                  situacao: 'convertida',
                }),
              ],
            }
          : r,
      ),
    }
    return comEvento(atualizado, {
      imovelId: dados.imovelId,
      tipo: 'Venda',
      descricao: `Venda registrada para ${cliente.nome}`,
      autor: usuario.nome,
      referencia: codigo,
      situacao: ROTULO_SITUACAO.vendido,
    })
  })
  return criada
}

export async function concluirEscritura(vendaId: string, usuario: UsuarioVenda) {
  await esperar()
  atualizarDb((db) => {
    exigirPermissao(podeConcluirEscritura(usuario, db.permissoes))
    const venda = acharVenda(db, vendaId)
    if (!podeConcluir(venda)) throw new Error('Só vendas Em escritura podem ser concluídas.')
    const agora = new Date().toISOString()
    const atualizado = comVenda(
      db,
      venda,
      { status: 'concluida' },
      eventoVenda('conclusao', agora, {
        autor: usuario.nome,
        statusAnterior: venda.status,
        status: 'concluida',
        detalhe: 'Escritura concluída',
      }),
    )
    return comEvento(atualizado, {
      imovelId: venda.imovelId,
      tipo: 'Venda',
      descricao: 'Escritura da venda concluída',
      autor: usuario.nome,
      referencia: venda.codigo,
      situacao: ROTULO_SITUACAO.vendido,
    })
  })
}

export type DadosCancelamento = Omit<CancelamentoVenda, 'em' | 'autor'>

/**
 * RF24: cancela a venda com justificativa obrigatória. O imóvel fica bloqueado
 * ("Venda cancelada") e só volta ao estoque depois da reabilitação.
 */
export async function cancelarVenda(vendaId: string, dados: DadosCancelamento, usuario: UsuarioVenda) {
  await esperar()
  atualizarDb((db) => {
    exigirPermissao(podeCancelarVenda(usuario, db.permissoes))
    const venda = acharVenda(db, vendaId)
    if (!podeCancelar(venda)) throw new Error('Esta venda já está cancelada.')
    const erro = validarJustificativa(dados.justificativa)
    if (erro) throw new Error(erro)
    const justificativa = dados.justificativa.trim()
    const agora = new Date().toISOString()
    const devolucao = dados.devolucao !== undefined ? `devolução de ${formatarMoedaInteira(dados.devolucao)}` : ''
    const detalhe = [dados.motivo, justificativa, devolucao].filter(Boolean).join(' · ')
    let atualizado = comVenda(
      db,
      venda,
      { status: 'cancelada', cancelamento: { ...dados, justificativa, em: agora, autor: usuario.nome } },
      eventoVenda('cancelamento', agora, {
        autor: usuario.nome,
        statusAnterior: venda.status,
        status: 'cancelada',
        detalhe: `${STATUS_VENDA[venda.status].rotulo} → Cancelada · ${detalhe}`,
      }),
    )
    acharImovel(atualizado, venda.imovelId)
    atualizado = {
      ...atualizado,
      imoveis: atualizado.imoveis.map((i) =>
        i.id === venda.imovelId
          ? {
              ...i,
              situacao: 'bloqueado',
              bloqueio: { motivo: 'Venda cancelada', justificativa, em: agora },
              publicacao: { ...i.publicacao, catalogo: false },
              atualizadoEm: agora,
            }
          : i,
      ),
    }
    return comEvento(atualizado, {
      imovelId: venda.imovelId,
      tipo: 'Cancelamento',
      descricao: `Venda cancelada: ${detalhe}`,
      autor: usuario.nome,
      referencia: venda.codigo,
      situacao: ROTULO_SITUACAO.bloqueado,
    })
  })
}
