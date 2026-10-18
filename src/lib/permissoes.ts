import type { MatrizPermissoes, Perfil, Permissao, Proposta } from '../data/types'
import { CONFIG_PROPOSTAS, etapaAtual, podeDecidir } from './propostas'

/**
 * Perfis de acesso e permissões (tela "Usuários e permissões").
 * A matriz em vigor fica no banco (`Db.permissoes`) e o Administrador a edita
 * na tela; aqui ficam a lista de permissões, a matriz padrão e as regras de
 * verificação. Com o backend, ele também precisa validar cada ação; esconder
 * botões aqui não basta.
 */

export interface DadosPerfil {
  perfil: Perfil
  /** Rótulo curto da coluna da matriz. */
  sigla: string
  descricao: string
}

/** Em ordem hierárquica; é a ordem dos cards, da matriz e da lista de usuários. */
export const PERFIS: readonly DadosPerfil[] = [
  { perfil: 'Administrador', sigla: 'Admin', descricao: 'Acesso total ao sistema' },
  { perfil: 'Gerente comercial', sigla: 'Gerente', descricao: 'Aprova propostas e descontos' },
  { perfil: 'Corretor', sigla: 'Corretor', descricao: 'Cria reservas e propostas' },
  { perfil: 'Coletor', sigla: 'Coletor', descricao: 'Cadastra imóveis em campo' },
]

export interface RegraPermissao {
  permissao: Permissao
  rotulo: string
  /** Perfis com a permissão na matriz padrão (seed). */
  padrao: readonly Perfil[]
}

const ADMIN_GERENTE: readonly Perfil[] = ['Administrador', 'Gerente comercial']

/**
 * Linhas da matriz, na ordem da tela. As 11 do protótipo mais duas definidas
 * com o produto em 18/10/2026: gestão de clientes e bloqueio de imóveis (RF25).
 */
export const PERMISSOES: readonly RegraPermissao[] = [
  { permissao: 'cadastrar_imoveis', rotulo: 'Cadastrar e editar imóveis', padrao: [...ADMIN_GERENTE, 'Coletor'] },
  { permissao: 'publicar_imoveis', rotulo: 'Publicar imóvel no catálogo público', padrao: ADMIN_GERENTE },
  { permissao: 'bloquear_imoveis', rotulo: 'Bloquear e reabilitar imóveis', padrao: ADMIN_GERENTE },
  { permissao: 'gerenciar_clientes', rotulo: 'Cadastrar, editar, ativar e excluir clientes', padrao: [...ADMIN_GERENTE, 'Corretor'] },
  { permissao: 'registrar_reserva', rotulo: 'Registrar reserva para cliente', padrao: [...ADMIN_GERENTE, 'Corretor'] },
  { permissao: 'cancelar_reserva', rotulo: 'Cancelar reserva antes do vencimento', padrao: ADMIN_GERENTE },
  { permissao: 'criar_proposta', rotulo: 'Criar proposta comercial', padrao: [...ADMIN_GERENTE, 'Corretor'] },
  { permissao: 'aprovar_proposta', rotulo: 'Aprovar proposta dentro da alçada', padrao: ADMIN_GERENTE },
  {
    permissao: 'aprovar_desconto_acima_alcada',
    rotulo: `Aprovar desconto acima de ${CONFIG_PROPOSTAS.alcadaGestorPercentual}%`,
    padrao: ['Administrador'],
  },
  { permissao: 'registrar_venda', rotulo: 'Registrar venda', padrao: ADMIN_GERENTE },
  { permissao: 'cancelar_venda', rotulo: 'Cancelar venda registrada', padrao: ['Administrador'] },
  { permissao: 'emitir_relatorios', rotulo: 'Emitir relatórios e exportar dados', padrao: ADMIN_GERENTE },
  { permissao: 'gerenciar_usuarios', rotulo: 'Gerenciar usuários e permissões', padrao: ['Administrador'] },
]

/** Células que não podem ser desmarcadas: sem elas ninguém mais administraria o sistema. */
export const CELULAS_TRAVADAS: readonly { permissao: Permissao; perfil: Perfil }[] = [
  { permissao: 'gerenciar_usuarios', perfil: 'Administrador' },
]

export const celulaTravada = (permissao: Permissao, perfil: Perfil) =>
  CELULAS_TRAVADAS.some((c) => c.permissao === permissao && c.perfil === perfil)

export function matrizPadrao(): MatrizPermissoes {
  return Object.fromEntries(PERMISSOES.map((r) => [r.permissao, [...r.padrao]])) as MatrizPermissoes
}

/** Na ordem de `PERFIS`, sem repetição, sem perfis desconhecidos e com as células travadas sempre marcadas. */
export function normalizarMatriz(matriz: MatrizPermissoes): MatrizPermissoes {
  return Object.fromEntries(
    PERMISSOES.map(({ permissao }) => {
      const marcados = matriz[permissao] ?? []
      return [permissao, PERFIS.map((p) => p.perfil).filter((p) => marcados.includes(p) || celulaTravada(permissao, p))]
    }),
  ) as MatrizPermissoes
}

export interface MudancaPermissao {
  permissao: Permissao
  perfil: Perfil
  concedida: boolean
}

/** Células que mudaram de uma matriz para a outra, na ordem da tela. */
export function diferencasMatriz(antes: MatrizPermissoes, depois: MatrizPermissoes): MudancaPermissao[] {
  return PERMISSOES.flatMap(({ permissao }) =>
    PERFIS.flatMap(({ perfil }) => {
      const tinha = (antes[permissao] ?? []).includes(perfil)
      const tem = (depois[permissao] ?? []).includes(perfil)
      return tinha === tem ? [] : [{ permissao, perfil, concedida: tem }]
    }),
  )
}

export const rotuloPermissao = (permissao: Permissao) => PERMISSOES.find((r) => r.permissao === permissao)?.rotulo ?? permissao

/** Perfis que têm a permissão na matriz informada, na ordem de `PERFIS`. */
export function perfisCom(permissao: Permissao, matriz: MatrizPermissoes): Perfil[] {
  const perfis = matriz[permissao] ?? []
  return PERFIS.map((p) => p.perfil).filter((p) => perfis.includes(p))
}

/** `papel` é string porque a sessão pode vir vazia ou de uma versão antiga do banco. */
export function pode(usuario: { papel: string } | null | undefined, permissao: Permissao, matriz: MatrizPermissoes) {
  if (!usuario) return false
  return (matriz[permissao] ?? []).some((p) => p === usuario.papel)
}

/**
 * Decidir (aprovar, recusar, contrapropor) exige ser o responsável pela etapa atual
 * e ter a permissão dela: a diretoria responde pelo desconto acima da alçada.
 */
export function podeDecidirProposta(
  p: Proposta,
  usuario: { id: string; papel: string } | null | undefined,
  agora: number,
  matriz: MatrizPermissoes,
) {
  if (!usuario || !podeDecidir(p, usuario.id, agora)) return false
  return pode(usuario, etapaAtual(p)?.tipo === 'diretoria' ? 'aprovar_desconto_acima_alcada' : 'aprovar_proposta', matriz)
}
