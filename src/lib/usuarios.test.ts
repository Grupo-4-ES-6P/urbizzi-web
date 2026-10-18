import type { Perfil, Usuario } from '../data/types'
import { matrizPadrao } from './permissoes'
import {
  contarAtivosPorPerfil,
  filtrarUsuarios,
  formatarUltimoAcesso,
  impedimentoAlterarPerfil,
  impedimentoInativar,
  ordenarUsuarios,
  responsaveisComerciais,
  validarConvite,
} from './usuarios'

const usuario = (id: string, nome: string, papel: Perfil, ativo = true): Usuario => ({
  id,
  nome,
  email: `${id}@urbizzi.com.br`,
  senha: 'x',
  papel,
  ativo,
  ultimoAcesso: null,
})

const equipe = [
  usuario('c1', 'Renata', 'Corretor', false),
  usuario('c2', 'Matheus', 'Corretor'),
  usuario('k1', 'Gustavo', 'Coletor'),
  usuario('g1', 'Gabriela', 'Gerente comercial'),
  usuario('a1', 'Ayran', 'Administrador'),
  usuario('c3', 'João', 'Corretor'),
  usuario('g2', 'Arthur', 'Gerente comercial'),
]

describe('lista de usuários', () => {
  it('ordena ativos primeiro, por perfil e por nome', () => {
    expect(ordenarUsuarios(equipe).map((u) => u.nome)).toEqual(['Ayran', 'Arthur', 'Gabriela', 'João', 'Matheus', 'Gustavo', 'Renata'])
  })

  it('filtra por perfil, status e busca sem acento', () => {
    expect(filtrarUsuarios(equipe, { q: '', perfil: 'Corretor', status: '' })).toHaveLength(3)
    expect(filtrarUsuarios(equipe, { q: '', perfil: 'Corretor', status: 'ativo' }).map((u) => u.nome)).toEqual(['Matheus', 'João'])
    expect(filtrarUsuarios(equipe, { q: 'JOAO', perfil: '', status: '' }).map((u) => u.nome)).toEqual(['João'])
    expect(filtrarUsuarios(equipe, { q: 'g1@', perfil: '', status: '' }).map((u) => u.nome)).toEqual(['Gabriela'])
  })

  it('conta só os ativos por perfil', () => {
    expect(Object.fromEntries(contarAtivosPorPerfil(equipe))).toEqual({
      Administrador: 1,
      'Gerente comercial': 2,
      Corretor: 2,
      Coletor: 1,
    })
  })

  it('responsáveis comerciais: ativos que registram reserva (sem coletor nem inativo)', () => {
    expect(responsaveisComerciais(equipe, matrizPadrao()).map((u) => u.nome)).toEqual(['Arthur', 'Ayran', 'Gabriela', 'João', 'Matheus'])
  })
})

describe('último acesso', () => {
  const agora = new Date(2026, 9, 12, 10, 0).getTime()
  const em = (dia: number, h: number, min: number) => new Date(2026, 9, dia, h, min).toISOString()

  it('segue os formatos do protótipo', () => {
    expect(formatarUltimoAcesso(em(12, 9, 58), agora)).toBe('Agora')
    expect(formatarUltimoAcesso(em(12, 8, 41), agora)).toBe('Hoje · 08:41')
    expect(formatarUltimoAcesso(em(11, 17, 22), agora)).toBe('Ontem · 17:22')
    expect(formatarUltimoAcesso(em(9, 23, 59), agora)).toBe('3 dias atrás')
    expect(formatarUltimoAcesso(null, agora)).toBe('Nunca acessou')
  })
})

describe('regras de alteração', () => {
  it('ninguém inativa a si mesmo nem o último administrador ativo', () => {
    expect(impedimentoInativar(equipe[4], 'a1', equipe)).toBe('Você não pode inativar o próprio usuário.')
    expect(impedimentoInativar(equipe[4], 'outro', equipe)).toBe('O sistema precisa de pelo menos um administrador ativo.')
    expect(impedimentoInativar(equipe[1], 'a1', equipe)).toBeNull()
    const doisAdmins = [...equipe, usuario('a2', 'Fernanda', 'Administrador')]
    expect(impedimentoInativar(equipe[4], 'a2', doisAdmins)).toBeNull()
  })

  it('não troca o próprio perfil nem rebaixa o último administrador', () => {
    expect(impedimentoAlterarPerfil(equipe[4], 'Corretor', 'a1', equipe)).toBe('Você não pode alterar o próprio perfil.')
    expect(impedimentoAlterarPerfil(equipe[4], 'Corretor', 'outro', equipe)).toBe('O sistema precisa de pelo menos um administrador ativo.')
    expect(impedimentoAlterarPerfil(equipe[1], 'Gerente comercial', 'a1', equipe)).toBeNull()
  })
})

describe('convite', () => {
  it('exige nome, e-mail válido e único, e perfil', () => {
    expect(validarConvite({ nome: '', email: '', papel: '' }, [])).toEqual({
      nome: 'Informe o nome completo.',
      email: 'Informe o e-mail.',
      papel: 'Selecione o perfil.',
    })
    expect(validarConvite({ nome: 'Ana Souza', email: 'ana@', papel: 'Corretor' }, []).email).toBe('Informe um e-mail válido.')
    expect(validarConvite({ nome: 'Ana Souza', email: ' ANA@urbizzi.com.br ', papel: 'Corretor' }, ['ana@urbizzi.com.br']).email).toBe(
      'Já existe um usuário com este e-mail.',
    )
    expect(validarConvite({ nome: 'Ana Souza', email: 'ana@urbizzi.com.br', papel: 'Corretor' }, [])).toEqual({})
  })
})
