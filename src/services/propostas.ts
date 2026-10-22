import { atualizarDb } from '../data/db'
import { reservaAtiva } from '../data/selectors'
import type { Proposta, UsuarioPublico } from '../data/types'

export type DadosNovaProposta = Pick<Proposta,
  'imovelId' | 'clienteId' | 'valor' | 'entrada' | 'parcelas' | 'indiceCorrecao' | 'primeiroVencimento' |
  'formaPagamento' | 'validadeDias' | 'aprovador' | 'observacoes' | 'anexos'
>

export function validarProposta(dados: DadosNovaProposta) {
  const erros: Record<string, string> = {}
  if (!dados.imovelId) erros.imovelId = 'Selecione um imóvel.'
  if (!dados.clienteId) erros.clienteId = 'Selecione um cliente.'
  if (!Number.isFinite(dados.valor) || dados.valor <= 0) erros.valor = 'Informe um valor maior que zero.'
  if (!Number.isFinite(dados.entrada) || (dados.entrada ?? 0) < 0 || (dados.entrada ?? 0) > dados.valor) {
    erros.entrada = 'A entrada deve ficar entre zero e o valor da proposta.'
  }
  if (!Number.isInteger(dados.parcelas) || (dados.parcelas ?? 0) < 1) erros.parcelas = 'Informe ao menos uma parcela.'
  if (!dados.primeiroVencimento) erros.primeiroVencimento = 'Informe o primeiro vencimento.'
  if (!dados.formaPagamento?.trim()) erros.formaPagamento = 'Informe a forma de pagamento.'
  if (!Number.isInteger(dados.validadeDias) || (dados.validadeDias ?? 0) < 1 || (dados.validadeDias ?? 0) > 7) {
    erros.validadeDias = 'A validade deve ser de 1 a 7 dias.'
  }
  return erros
}

function proximoCodigo(codigos: string[]) {
  const ano = new Date().getFullYear()
  const sequencia = codigos
    .filter((codigo) => codigo.startsWith(`PROP-${ano}-`))
    .reduce((maior, codigo) => Math.max(maior, Number(codigo.split('-').at(-1)) || 0), 0) + 1
  return `PROP-${ano}-${String(sequencia).padStart(4, '0')}`
}

export function salvarProposta(dados: DadosNovaProposta, status: 'rascunho' | 'pendente', id?: string, autor?: UsuarioPublico) {
  if (!dados.imovelId || !dados.clienteId) throw new Error('Selecione um imóvel e um cliente.')
  if (status === 'pendente' && Object.keys(validarProposta(dados)).length) {
    throw new Error('Revise os campos destacados.')
  }

  let salvoId = id ?? ''
  atualizarDb((db) => {
    const imovel = db.imoveis.find((item) => item.id === dados.imovelId)
    const cliente = db.clientes.find((item) => item.id === dados.clienteId)
    if (!cliente) throw new Error('O cliente selecionado não foi encontrado.')
    if (!imovel || imovel.status !== 'publicado' || imovel.situacao !== 'disponivel' ||
      db.reservas.some((item) => item.imovelId === dados.imovelId && reservaAtiva(item, Date.now()))) {
      throw new Error('O imóvel selecionado não está disponível para proposta.')
    }
    const anterior = id ? db.propostas.find((item) => item.id === id) : undefined
    if (id && (!anterior || anterior.status !== 'rascunho')) throw new Error('Este rascunho não pode mais ser alterado.')
    if (status === 'pendente' && db.propostas.some((item) =>
      item.id !== id && item.imovelId === dados.imovelId && item.status === 'pendente')) {
      throw new Error('Este imóvel já possui uma proposta em aprovação.')
    }

    salvoId = anterior?.id ?? `pro-${crypto.randomUUID()}`
    const agora = new Date()
    const expiraEm = new Date(agora)
    const validadeDias = Number.isInteger(dados.validadeDias) && (dados.validadeDias ?? 0) > 0
      ? dados.validadeDias ?? 7
      : 7
    expiraEm.setDate(expiraEm.getDate() + validadeDias)
    const condicao = `Entrada de ${dados.entrada ?? 0} + ${dados.parcelas ?? 1} parcelas · ${dados.formaPagamento}`
    const proposta: Proposta = {
      id: salvoId,
      codigo: anterior?.codigo ?? proximoCodigo(db.propostas.map((item) => item.codigo)),
      corretorId: anterior?.corretorId ?? autor?.id ?? '',
      criadaEm: anterior?.criadaEm ?? agora.toISOString(),
      status,
      condicao,
      ...dados,
      expiraEm: expiraEm.toISOString(),
    }
    return {
      ...db,
      propostas: anterior
        ? db.propostas.map((item) => item.id === anterior.id ? proposta : item)
        : [...db.propostas, proposta],
      historico: status === 'pendente'
        ? [...db.historico, {
          id: `his-${crypto.randomUUID()}`,
          imovelId: dados.imovelId,
          data: agora.toISOString(),
          tipo: 'Proposta',
          descricao: `Proposta ${proposta.codigo} enviada para aprovação`,
          autor: autor?.nome ?? 'Equipe comercial',
          referencia: proposta.codigo,
          situacao: { rotulo: 'Em aprovação', variante: 'escuro' as const },
        }]
        : db.historico,
    }
  })
  return salvoId
}
