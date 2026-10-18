import { celulaTravada, diferencasMatriz, matrizPadrao, normalizarMatriz, PERFIS, PERMISSOES, perfisCom, pode } from './permissoes'

const padrao = matrizPadrao()

describe('matriz padrão', () => {
  it('reproduz o protótipo, com as duas regras definidas pelo produto', () => {
    const marcas = PERMISSOES.map((r) => [r.rotulo, PERFIS.map((p) => (padrao[r.permissao].includes(p.perfil) ? '●' : '—')).join('')])
    expect(marcas).toEqual([
      ['Cadastrar e editar imóveis', '●●—●'],
      ['Publicar imóvel no catálogo público', '●●——'],
      ['Bloquear e reabilitar imóveis', '●●——'],
      ['Cadastrar, editar, ativar e excluir clientes', '●●●—'],
      ['Registrar reserva para cliente', '●●●—'],
      ['Cancelar reserva antes do vencimento', '●●——'],
      ['Criar proposta comercial', '●●●—'],
      ['Aprovar proposta dentro da alçada', '●●——'],
      ['Aprovar desconto acima de 5%', '●———'],
      ['Registrar venda', '●●——'],
      ['Cancelar venda registrada', '●———'],
      ['Emitir relatórios e exportar dados', '●●——'],
      ['Gerenciar usuários e permissões', '●———'],
    ])
  })

  it('cada chamada devolve uma cópia independente', () => {
    const outra = matrizPadrao()
    outra.registrar_venda.push('Corretor')
    expect(matrizPadrao().registrar_venda).toEqual(['Administrador', 'Gerente comercial'])
  })
})

describe('pode', () => {
  it('consulta a matriz recebida', () => {
    expect(pode({ papel: 'Corretor' }, 'registrar_venda', padrao)).toBe(false)
    expect(pode({ papel: 'Corretor' }, 'registrar_venda', { ...padrao, registrar_venda: ['Corretor'] })).toBe(true)
  })

  it('sem sessão ou com perfil desconhecido, nada é permitido', () => {
    expect(pode(null, 'registrar_reserva', padrao)).toBe(false)
    expect(pode(undefined, 'registrar_reserva', padrao)).toBe(false)
    expect(pode({ papel: 'Gestor comercial' }, 'registrar_reserva', padrao)).toBe(false)
    expect(pode({ papel: '' }, 'registrar_reserva', padrao)).toBe(false)
  })

  it('perfisCom segue a ordem dos perfis', () => {
    expect(perfisCom('aprovar_proposta', { ...padrao, aprovar_proposta: ['Gerente comercial', 'Administrador'] })).toEqual([
      'Administrador',
      'Gerente comercial',
    ])
  })
})

describe('edição da matriz', () => {
  it('o Administrador nunca perde a gestão de usuários', () => {
    expect(celulaTravada('gerenciar_usuarios', 'Administrador')).toBe(true)
    expect(celulaTravada('gerenciar_usuarios', 'Gerente comercial')).toBe(false)
    expect(normalizarMatriz({ ...padrao, gerenciar_usuarios: [] }).gerenciar_usuarios).toEqual(['Administrador'])
  })

  it('normaliza ordem, repetições e perfis desconhecidos', () => {
    const suja = { ...padrao, criar_proposta: ['Corretor', 'Administrador', 'Corretor'] } as typeof padrao
    expect(normalizarMatriz(suja).criar_proposta).toEqual(['Administrador', 'Corretor'])
  })

  it('lista só as células alteradas', () => {
    const nova = {
      ...padrao,
      cancelar_reserva: ['Administrador' as const],
      registrar_venda: [...padrao.registrar_venda, 'Corretor' as const],
    }
    expect(diferencasMatriz(padrao, nova)).toEqual([
      { permissao: 'cancelar_reserva', perfil: 'Gerente comercial', concedida: false },
      { permissao: 'registrar_venda', perfil: 'Corretor', concedida: true },
    ])
    expect(diferencasMatriz(padrao, matrizPadrao())).toEqual([])
  })
})
