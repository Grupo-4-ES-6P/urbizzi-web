import type { Cliente, ContatoComercial } from '../data/types'
import { clienteVazio } from './clienteForm'
import { situacaoCliente, ultimoContato, type VinculosClientes } from './clientes'

const semVinculos = (): VinculosClientes => ({ comVenda: new Set(), comReservaAtiva: new Set(), comPropostaEmAndamento: new Set() })

function contato(data: string, resultado: ContatoComercial['resultado']): ContatoComercial {
  return { id: `ctt-${data}`, data, canal: 'WhatsApp', responsavel: 'Ayran Bade', imovelId: '', assunto: 'Teste', resultado }
}

function cliente(parcial: Partial<Cliente> = {}): Cliente {
  return { ...clienteVazio(), id: 'cli-1', nome: 'Marina', criadoEm: '', atualizadoEm: '', ...parcial }
}

describe('situação comercial do cliente', () => {
  it('usa o contato mais recente', () => {
    const c = cliente({ contatos: [contato('2026-08-09', 'novo'), contato('2026-08-22', 'sem_retorno')] })
    expect(ultimoContato(c)?.data).toBe('2026-08-22')
    expect(situacaoCliente(c, semVinculos())).toBe('sem_retorno')
  })

  it('cliente sem contatos é novo e parceiro vem da origem', () => {
    expect(situacaoCliente(cliente(), semVinculos())).toBe('novo')
    expect(situacaoCliente(cliente({ origem: 'Parceiro' }), semVinculos())).toBe('parceiro')
  })

  it('venda, reserva e proposta pesam mais que o último contato', () => {
    const c = cliente({ contatos: [contato('2026-08-22', 'em_andamento')] })
    expect(situacaoCliente(c, semVinculos())).toBe('em_negociacao')
    expect(situacaoCliente(c, { ...semVinculos(), comPropostaEmAndamento: new Set(['cli-1']) })).toBe('proposta_enviada')
    expect(situacaoCliente(c, { ...semVinculos(), comReservaAtiva: new Set(['cli-1']), comPropostaEmAndamento: new Set(['cli-1']) })).toBe('reserva_ativa')
    expect(situacaoCliente(c, { ...semVinculos(), comVenda: new Set(['cli-1']), comReservaAtiva: new Set(['cli-1']) })).toBe('venda_concluida')
    expect(situacaoCliente({ ...c, ativo: false }, { ...semVinculos(), comVenda: new Set(['cli-1']) })).toBe('inativo')
  })
})
