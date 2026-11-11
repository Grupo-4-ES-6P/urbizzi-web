/** Perfis de acesso e matriz de permissões (RF34). */
export const PERFIS = ['Administrador', 'Gerente comercial', 'Corretor', 'Coletor'] as const
export type Perfil = (typeof PERFIS)[number]

export const DESCRICAO_PERFIL: Record<Perfil, string> = {
  Administrador: 'Acesso total ao sistema',
  'Gerente comercial': 'Aprova propostas e descontos',
  Corretor: 'Cria reservas e propostas',
  Coletor: 'Cadastra imóveis em campo',
}

export const ABREVIACAO_PERFIL: Record<Perfil, string> = {
  Administrador: 'Admin',
  'Gerente comercial': 'Gerente',
  Corretor: 'Corretor',
  Coletor: 'Coletor',
}

export const PERMISSOES = [
  { id: 'cadastrar_imoveis', rotulo: 'Cadastrar e editar imóveis' },
  { id: 'publicar_catalogo', rotulo: 'Publicar imóvel no catálogo público' },
  { id: 'registrar_reserva', rotulo: 'Registrar reserva para cliente' },
  { id: 'cancelar_reserva', rotulo: 'Cancelar reserva antes do vencimento' },
  { id: 'criar_proposta', rotulo: 'Criar proposta comercial' },
  { id: 'aprovar_proposta', rotulo: 'Aprovar proposta dentro da alçada' },
  { id: 'aprovar_desconto', rotulo: 'Aprovar desconto acima de 5%' },
  { id: 'registrar_venda', rotulo: 'Registrar venda' },
  { id: 'cancelar_venda', rotulo: 'Cancelar venda registrada' },
  { id: 'emitir_relatorios', rotulo: 'Emitir relatórios e exportar dados' },
  { id: 'gerenciar_usuarios', rotulo: 'Gerenciar usuários e permissões' },
] as const

/** Permissão que o administrador nunca perde, para ninguém ficar sem acesso à tela. */
export const PERMISSAO_TRAVADA = 'gerenciar_usuarios'

export const PERMISSOES_PADRAO: Record<string, Perfil[]> = {
  cadastrar_imoveis: ['Administrador', 'Gerente comercial', 'Coletor'],
  publicar_catalogo: ['Administrador', 'Gerente comercial'],
  registrar_reserva: ['Administrador', 'Gerente comercial', 'Corretor'],
  cancelar_reserva: ['Administrador', 'Gerente comercial'],
  criar_proposta: ['Administrador', 'Gerente comercial', 'Corretor'],
  aprovar_proposta: ['Administrador', 'Gerente comercial'],
  aprovar_desconto: ['Administrador'],
  registrar_venda: ['Administrador', 'Gerente comercial'],
  cancelar_venda: ['Administrador'],
  emitir_relatorios: ['Administrador', 'Gerente comercial'],
  gerenciar_usuarios: ['Administrador'],
}

export const VARIANTE_PERFIL: Record<Perfil, string> = {
  Administrador: 'perfil-admin',
  'Gerente comercial': 'perfil-gerente',
  Corretor: 'perfil-corretor',
  Coletor: 'perfil-coletor',
}
