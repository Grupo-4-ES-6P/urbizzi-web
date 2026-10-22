import { LOTEAMENTOS, type LoteamentoInicial } from './catalogos'
import { formatarMoedaInteira } from '../lib/format'
import { CANAIS_CONTATO, ORIGENS_CLIENTE, ordenarContatos } from '../lib/clientes'
import type {
  Cliente,
  ContatoComercial,
  CondicoesProposta,
  EtapaAprovacao,
  EventoProposta,
  SituacaoVersao,
  Usuario,
  VersaoProposta,
  Db,
  Documento,
  EventoHistorico,
  Imovel,
  Interesse,
  Loteamento,
  Pessoa,
  Proposta,
  Quadra,
  ResultadoContato,
} from './types'

export const VERSAO_DB = 6

const HORA = 3_600_000
const DIA = 24 * HORA

const NOMES_CLIENTES = [
  'Marina Alves', 'Rafael Nunes', 'Construtora ML', 'Ana Paula S.', 'Tiago Ferraz',
  'Bruno Carvalho', 'Juliana Rocha', 'Felipe Moraes', 'Camila Duarte', 'Lucas Pereira',
  'Patrícia Gomes', 'Eduardo Lins', 'Vanessa Kuhn', 'Rodrigo Sartori', 'Aline Becker',
  'Gustavo Weber', 'Larissa Schmitt', 'Diego Hoffmann', 'Renata Prado', 'Marcos Vieira',
  'Tatiane Zanella', 'André Castilho', 'Sílvia Menegatti', 'Paulo Rinaldi', 'Beatriz Fontana',
]

const NOMES_COMPRADORES = ['Silvana Costa', 'Marcos Antunes', 'Incorp. Vertice', 'Priscila Damo', 'Eduardo Reck', 'Fernanda Luz', 'Ricardo Sesc']
const PREFIXOS_JURIDICA = ['Construtora', 'Incorp.']

const NOMES_CORRETORES = ['J. Biló', 'D. Krüger', 'M. Oening', 'A. Pacheco', 'G. Lima', 'G. Krüger']

const RUAS: Record<string, string[]> = {
  'Lot. Universitário': ['Rua das Acácias', 'Rua dos Ipês', 'Rua Universitária'],
  'Jd. Europa': ['Rua Lisboa', 'Rua Madri', 'Rua Viena'],
  'Biopark Toledo': ['Av. Ministro Cirne Lima'],
  'Jd. Porto Alegre': ['Rua Guaíba', 'Rua Farroupilha'],
}

const PROFISSOES = ['Engenheira civil', 'Professor', 'Médica', 'Advogado', 'Comerciante', 'Agricultor', 'Analista de sistemas', 'Enfermeira', 'Contador', 'Arquiteta']
const ESTADOS_CIVIS = ['Solteiro(a)', 'Casado(a)', 'Casado(a)', 'Divorciado(a)', 'União estável']
const RUAS_CLIENTES = ['Rua Barão do Rio Branco', 'Av. Parigot de Souza', 'Rua Sarandi', 'Rua Guarani', 'Av. Maripá', 'Rua São João', 'Rua Rui Barbosa']
const BAIRROS_CLIENTES = ['Centro', 'Jardim Gisela', 'Vila Industrial', 'Jardim La Salle', 'Vila Becker', 'Jardim Porto Alegre']
const CLIENTES_INATIVOS = ['Sílvia Menegatti', 'Paulo Rinaldi']

/** PRNG determinístico para que os dados de demonstração sejam sempre os mesmos. */
function mulberry32(semente: number) {
  let a = semente
  return () => {
    // `>>> 0` mantém o estado como inteiro de 32 bits (mesmos bits do algoritmo original).
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Acrescenta os dois dígitos verificadores (CPF/CNPJ) para gerar documentos válidos na demonstração. */
function comDigitos(base: number[], peso: (i: number, tamanho: number) => number, digito: (soma: number) => number) {
  const digitos = [...base]
  for (let k = 0; k < 2; k++) {
    const soma = digitos.reduce((s, d, i) => s + d * peso(i, digitos.length), 0)
    digitos.push(digito(soma))
  }
  return digitos.join('')
}

function gerarCpf(rand: () => number) {
  const base = Array.from({ length: 9 }, () => Math.floor(rand() * 10))
  const d = comDigitos(base, (i, n) => n + 1 - i, (s) => ((s * 10) % 11) % 10)
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

const PESOS_CNPJ = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

function gerarCnpj(rand: () => number) {
  const base = [...Array.from({ length: 8 }, () => Math.floor(rand() * 10)), 0, 0, 0, 1]
  const d = comDigitos(base, (i, n) => PESOS_CNPJ[i + 13 - n], (s) => (s % 11 < 2 ? 0 : 11 - (s % 11)))
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

const pad = (n: number) => String(n).padStart(2, '0')
const pad4 = (n: number) => String(n).padStart(4, '0')
const arredondar = (v: number, passo = 500) => Math.round(v / passo) * passo

const iso = (ms: number) => new Date(ms).toISOString()

function fimDoDia(ms: number) {
  const d = new Date(ms)
  d.setHours(23, 59, 59, 999)
  return d.getTime()
}

function montarCliente(nome: string, i: number, rnd: () => number, agoraMs: number): Cliente {
  const sortear = <T,>(lista: T[]) => lista[Math.floor(rnd() * lista.length)]
  const juridica = PREFIXOS_JURIDICA.some((p) => nome.startsWith(p))
  const usuarioEmail = nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f.]/g, '')
    .toLowerCase()
    .replaceAll(/\s+/g, '.')
  const criadoEm = new Date(agoraMs - (400 + Math.floor(rnd() * 400)) * DIA).toISOString()
  return {
    id: `cli-${i + 1}`,
    nome,
    tipoPessoa: juridica ? 'juridica' : 'fisica',
    cpfCnpj: juridica ? gerarCnpj(rnd) : gerarCpf(rnd),
    rg: '',
    dataNascimento: juridica
      ? ''
      : `${1960 + Math.floor(rnd() * 40)}-${pad(1 + Math.floor(rnd() * 12))}-${pad(1 + Math.floor(rnd() * 28))}`,
    estadoCivil: juridica ? '' : sortear(ESTADOS_CIVIS),
    profissao: juridica ? '' : sortear(PROFISSOES),
    telefone: `(45) 9${8800 + Math.floor(rnd() * 1199)}-${pad4(Math.floor(rnd() * 10000))}`,
    celular: '',
    email: `${usuarioEmail}@email.com`,
    ativo: !CLIENTES_INATIVOS.includes(nome),
    endereco: {
      cep: `859${pad(Math.floor(rnd() * 100))}-${String(Math.floor(rnd() * 1000)).padStart(3, '0')}`,
      logradouro: sortear(RUAS_CLIENTES),
      numero: String(100 + Math.floor(rnd() * 2900)),
      complemento: rnd() < 0.2 ? `Apto ${10 + Math.floor(rnd() * 90)}` : '',
      bairro: sortear(BAIRROS_CLIENTES),
      cidade: 'Toledo',
      uf: 'PR',
      pais: 'Brasil',
    },
    // Origem, responsável e contatos são preenchidos no fim, com gerador próprio.
    origem: '',
    responsavel: '',
    imovelInteresseId: '',
    contatos: [],
    criadoEm,
    atualizadoEm: criadoEm,
  }
}

/** Lotes de cada loteamento, numerados a partir do código 7701. */
function gerarImoveis(
  planos: { lot: LoteamentoInicial; quadras: number; lotes: number }[],
  rand: () => number,
  escolher: <T>(lista: T[]) => T,
  agoraMs: number,
): Imovel[] {
  const imoveis: Imovel[] = []
  let codigo = 7700
  for (const { lot, quadras, lotes } of planos) {
    const listaQuadras = quadras === 0 ? [''] : Array.from({ length: quadras }, (_, i) => pad(i + 1))
    const grande = lot.nome === 'Biopark Toledo'
    listaQuadras.forEach((quadra, qi) => {
      for (let l = 1; l <= lotes; l++) {
        const frente = grande ? 26 : escolher([12, 12.5, 13, 14, 15])
        const fundo = grande ? 50 : escolher([25, 28, 30])
        const area = frente * fundo
        const tabela = arredondar(area * lot.precoM2 * (0.95 + rand() * 0.1))
        const criadoEm = new Date(agoraMs - (40 + Math.floor(rand() * 360)) * DIA).toISOString()
        codigo += 1
        imoveis.push({
          id: `imo-${codigo}`,
          codigo: String(codigo),
          titulo: grande
            ? `Terreno Biopark ${area.toLocaleString('pt-BR')}m²`
            : `Terreno ${area.toLocaleString('pt-BR')}m² — ${lot.nome}`,
          matricula: String(40000 + imoveis.length * 7),
          tipo: grande ? 'Lote comercial' : 'Terreno em loteamento',
          loteamento: lot.nome,
          situacao: 'disponivel',
          endereco: {
            cep: lot.cep,
            logradouro: RUAS[lot.nome][qi % RUAS[lot.nome].length],
            numero: 's/n',
            bairro: lot.bairro,
            cidade: lot.cidade,
            uf: lot.uf,
            quadra,
            lote: pad(l),
          },
          geo: {
            lat: +(lot.centro.lat + (qi - quadras / 2) * 0.0009 + (rand() - 0.5) * 0.0004).toFixed(6),
            lng: +(lot.centro.lng + (l - lotes / 2) * 0.00035).toFixed(6),
          },
          dimensoes: { areaTotal: area, frente, fundo, topografia: escolher(['Plano', 'Plano', 'Aclive', 'Declive']) },
          valores: { tabela, minimo: arredondar(tabela * 0.92), prazoReservaHoras: 72 },
          publicacao: { catalogo: true, reservasOnline: true, destaque: rand() < 0.08 },
          fotos: [],
          status: 'publicado',
          criadoEm,
          atualizadoEm: criadoEm,
        })
      }
    })
  }
  return imoveis
}

const NOMES_INTERESSE = ['Marina Ferreira Duarte', 'Carlos Menezes', 'Fernanda Lopes', 'João Ribeiro', 'Priscila Nogueira', 'Henrique Dalla']

/** Cerca de um terço dos imóveis não bloqueados recebe de 1 a 6 interesses. */
function interessesDoImovel(imovel: Imovel, rand: () => number, escolher: <T>(lista: T[]) => T, novo: (nome: string, diasAtras: number) => void) {
  if (imovel.situacao === 'bloqueado' || rand() > 0.35) return
  const qtd = 1 + Math.floor(rand() * 6)
  for (let k = 0; k < qtd; k++) novo(escolher(NOMES_INTERESSE), 1 + Math.floor(rand() * 90))
}

type NovoEvento = (e: Omit<EventoHistorico, 'id'>) => void

/** Cadastro do lote e, quando houver, o bloqueio (o de venda cancelada entra com o cancelamento). */
function eventosDoImovel(imovel: Imovel, loteamentos: Loteamento[], autor: string, evento: NovoEvento) {
  const lot = loteamentos.find((l) => l.nome === imovel.loteamento)!
  evento({
    imovelId: imovel.id,
    data: imovel.criadoEm,
    tipo: 'Cadastro',
    descricao: imovel.endereco.quadra ? `Lote criado na geração da Qd. ${imovel.endereco.quadra}` : 'Lote cadastrado',
    autor,
    referencia: lot.codigo,
    situacao: { rotulo: 'Disponível', variante: 'normal' },
  })
  // O bloqueio por venda cancelada entra junto com o cancelamento, mais abaixo.
  if (imovel.bloqueio && imovel.bloqueio.motivo !== 'Venda cancelada') {
    evento({
      imovelId: imovel.id,
      data: imovel.bloqueio.em,
      tipo: 'Bloqueio',
      descricao: `Bloqueado: ${imovel.bloqueio.motivo.toLowerCase()}`,
      autor: 'Matheus Oening',
      situacao: { rotulo: 'Bloqueado', variante: 'escuro' },
    })
  }
}

const ASSUNTOS_CONTATO = [
  'Pediu simulação de parcelamento em 120x',
  'Visita ao lote com a família',
  'Apresentou opções de lotes de esquina',
  'Envio do catálogo do loteamento',
  'Formulário de interesse recebido',
  'Retorno sobre a documentação do lote',
  'Dúvidas sobre financiamento direto',
]
const RESULTADOS_SEED: ResultadoContato[] = ['em_andamento', 'positivo', 'positivo', 'sem_retorno', 'novo']

interface ContextoCadastroComercial {
  imoveis: Imovel[]
  nomeCorretor: (id: string) => string
  responsaveis: string[]
  agoraMs: number
}

/** RG ou inscrição estadual com formato plausível. */
function documentoSecundario(juridica: boolean, rnd: () => number) {
  const digitos = (n: number) => String(Math.floor(rnd() * 10 ** n)).padStart(n, '0')
  if (juridica) return `${digitos(2)}${digitos(6)}-${digitos(2)}`
  return `${pad(10 + Math.floor(rnd() * 90))}.${digitos(3)}.${digitos(3)}-${digitos(1)}`
}

/**
 * Origem, responsável, imóvel de interesse e contatos comerciais (RF11, RF12).
 * Usa gerador próprio para não alterar a sequência dos demais dados.
 */
function completarCadastroComercial(clientes: Cliente[], { imoveis, nomeCorretor, responsaveis, agoraMs }: ContextoCadastroComercial) {
  const rnd = mulberry32(20261016)
  const sortear = <T,>(lista: T[]) => lista[Math.floor(rnd() * lista.length)]
  const chance = (p: number) => rnd() < p
  const origensComuns = ORIGENS_CLIENTE.filter((o) => o !== 'Parceiro')
  for (const c of clientes) {
    const juridica = c.tipoPessoa === 'juridica'
    c.rg = documentoSecundario(juridica, rnd)
    c.celular = c.telefone
    c.telefone = chance(0.4) ? `(45) 3${pad(Math.floor(rnd() * 100))}${Math.floor(rnd() * 10)}-${pad4(Math.floor(rnd() * 10000))}` : ''
    c.origem = juridica && chance(0.5) ? 'Parceiro' : sortear(origensComuns)
    c.responsavel = sortear(responsaveis)
    c.imovelInteresseId = (chance(0.7) ? sortear(imoveis).id : '')
    const qtd = Math.floor(rnd() * 5)
    c.contatos = ordenarContatos(
      Array.from({ length: qtd }, (_, k): ContatoComercial => ({
        id: `ctt-${c.id}-${k + 1}`,
        data: '2/2/2',
        canal: sortear(CANAIS_CONTATO),
        responsavel: k === 0 ? c.responsavel : sortear(responsaveis),
        imovelId: chance(0.8) ? c.imovelInteresseId : '',
        assunto: sortear(ASSUNTOS_CONTATO),
        resultado: sortear(RESULTADOS_SEED),
      })),
    )
  }
}

function retirarDe(livres: Imovel[], imovel: Imovel) {
  const idx = livres.indexOf(imovel)
  if (idx >= 0) livres.splice(idx, 1)
  return imovel
}

/** Lote que não existe na geração regular, criado a partir de um vizinho do mesmo loteamento. */
function criarLoteExtra(imoveis: Imovel[], loteamento: string, quadra: string, lote: string) {
  const base = imoveis.find((i) => i.loteamento === loteamento && i.endereco.quadra === quadra) ?? imoveis.find((i) => i.loteamento === loteamento)!
  const codigo = 7701 + imoveis.length
  const novo: Imovel = {
    ...base,
    id: `imo-${codigo}`,
    codigo: String(codigo),
    matricula: String(40000 + imoveis.length * 7),
    endereco: { ...base.endereco, quadra, lote },
    geo: { lat: base.geo.lat, lng: base.geo.lng === null ? null : +(base.geo.lng + 0.0004).toFixed(6) },
    dimensoes: { ...base.dimensoes },
    valores: { ...base.valores },
    publicacao: { ...base.publicacao },
    fotos: [],
  }
  imoveis.push(novo)
  return novo
}

/** A cada três bloqueios, um é por faixa de serviço; os demais, por averbação pendente. */
function bloquear(imovel: Imovel, i: number, agoraMs: number) {
  const faixa = i % 3 === 0
  imovel.situacao = 'bloqueado'
  imovel.publicacao.catalogo = false
  imovel.bloqueio = {
    motivo: faixa ? 'Faixa de serviço / área técnica' : 'Pendência de averbação',
    justificativa: faixa ? 'Área reservada para passagem de rede.' : 'A averbação da unidade ainda não saiu no cartório.',
    em: new Date(agoraMs - (20 + i * 9) * DIA).toISOString(),
  }
}

/** Uma quadra por combinação de loteamento e identificação, na ordem em que aparecem. */
function gerarQuadras(imoveis: Imovel[]): Quadra[] {
  const quadras: Quadra[] = []
  for (const i of imoveis) {
    if (!quadras.some((q) => q.loteamento === i.loteamento && q.identificacao === i.endereco.quadra)) {
      quadras.push({
        id: `qua-${quadras.length + 1}`,
        loteamento: i.loteamento,
        identificacao: i.endereco.quadra,
        area: null,
        testadaPara: i.endereco.logradouro,
        criadaEm: i.criadoEm,
      })
    }
  }
  return quadras
}

interface ContextoHistorico {
  imoveis: Imovel[]
  loteamentos: Loteamento[]
  interesses: Interesse[]
  lote12: Imovel
  autores: string[]
  escolher: <T>(lista: T[]) => T
  nomeCliente: (id: string) => string
  nomeCorretor: (id: string) => string
  diasAtras: (d: number) => string
  agoraMs: number
}

/** Linha do tempo dos imóveis, em ordem de geração (somente leitura). */
function montarHistorico(ctx: ContextoHistorico): EventoHistorico[] {
  const { imoveis, loteamentos, interesses, lote12, autores, escolher, nomeCliente, nomeCorretor, diasAtras, agoraMs } = ctx
  const historico: EventoHistorico[] = []
  const evento = (e: Omit<EventoHistorico, 'id'>) => historico.push({ id: `his-${historico.length + 1}`, ...e })
  for (const imovel of imoveis) eventosDoImovel(imovel, loteamentos, escolher(autores), evento)
  // Linha do tempo detalhada do Lote 12 — Qd. 04 (reproduz o protótipo).
  const valorLote12 = lote12.valores.tabela!.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
  lote12.criadoEm = diasAtras(620)
  historico.find((e) => e.imovelId === lote12.id && e.tipo === 'Cadastro')!.data = lote12.criadoEm
  evento({ imovelId: lote12.id, data: diasAtras(600), tipo: 'Alteração', descricao: `Valor de tabela ajustado para ${valorLote12}`, autor: 'Matheus Oening', situacao: { rotulo: 'Disponível', variante: 'normal' } })
  evento({ imovelId: lote12.id, data: diasAtras(560), tipo: 'Bloqueio', descricao: 'Bloqueado por pendência de averbação', autor: 'Matheus Oening', situacao: { rotulo: 'Bloqueado', variante: 'escuro' } })
  evento({ imovelId: lote12.id, data: diasAtras(490), tipo: 'Reabilitação', descricao: 'Averbação concluída; imóvel liberado para venda', autor: 'Matheus Oening', referencia: `R-6/${lote12.matricula}`, situacao: { rotulo: 'Disponível', variante: 'normal' } })
  for (const it of interesses) {
    evento({ imovelId: it.imovelId, data: it.criadoEm, tipo: 'Interesse', descricao: 'Formulário recebido pelo catálogo público', autor: 'Sistema', referencia: it.codigo, situacao: { rotulo: 'Novo', variante: 'laranja' } })
  }
  evento({ imovelId: lote12.id, data: new Date(agoraMs - 2 * HORA).toISOString(), tipo: 'Sistema', descricao: 'Aviso de vencimento da reserva enviado ao responsável', autor: 'Sistema', situacao: { rotulo: 'Atenção', variante: 'atencao' } })
  return historico
}

type Responsavel = { id: string; nome: string; cargo: string }

/** Acima da alçada do gestor, a diretoria decide no fim e a análise comercial fecha no meio do prazo. */
function aprovacaoFinal(diretoria: boolean, inicio: number, fim: number, resp: (id: string) => Responsavel) {
  if (!diretoria) return { autor: 'Matheus Oening', diretoria: undefined, fimAnalise: fim }
  return { autor: 'Ayran Bade', diretoria: resp('usr-1'), fimAnalise: (inicio + fim) / 2 }
}

export function criarSeed(agora: Date): Db {
  const rand = mulberry32(20260824)
  const escolher = <T,>(lista: T[]) => lista[Math.floor(rand() * lista.length)]
  const agoraMs = agora.getTime()
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).getTime()

  // Gerador separado para clientes e reservas encerradas: assim os demais dados não mudam.
  const rand2 = mulberry32(20261003)

  const clientes: Cliente[] = NOMES_CLIENTES.map((nome, i) => montarCliente(nome, i, rand2, agoraMs))
  // Compradores do prot\u00f3tipo de vendas, com gerador pr\u00f3prio para n\u00e3o alterar os clientes acima.
  const rand3 = mulberry32(20260812)
  for (const nome of NOMES_COMPRADORES) clientes.push(montarCliente(nome, clientes.length, rand3, agoraMs))
  const corretores: Pessoa[] = NOMES_CORRETORES.map((nome, i) => ({ id: `cor-${i + 1}`, nome }))
  const cliente = (nome: string) => clientes.find((c) => c.nome === nome)!.id
  const corretor = (nome: string) => corretores.find((c) => c.nome === nome)!.id

  const ano = agora.getFullYear()
  const planos: { lot: LoteamentoInicial; quadras: number; lotes: number }[] = [
    { lot: LOTEAMENTOS[0], quadras: 6, lotes: 12 },
    { lot: LOTEAMENTOS[1], quadras: 9, lotes: 8 },
    { lot: LOTEAMENTOS[2], quadras: 0, lotes: 44 },
    { lot: LOTEAMENTOS[3], quadras: 3, lotes: 10 },
  ]

  const imoveis = gerarImoveis(planos, rand, escolher, agoraMs)

  const achar = (loteamento: string, quadra: string, lote: string) =>
    imoveis.find(
      (i) => i.loteamento === loteamento && i.endereco.quadra === quadra && i.endereco.lote === lote,
    )!
  // Valores exibidos no protótipo de propostas (Lote 12 — Qd. 04 e Lote 31 — Biopark).
  for (const [imovel, minimo] of [[achar('Lot. Universitário', '04', '12'), 418_500], [achar('Biopark Toledo', '', '31'), 420_000]] as const) {
    imovel.valores = { ...imovel.valores, tabela: 455_000, minimo }
  }

  // Ordem embaralhada para distribuir as situações de forma determinística.
  const livres = [...imoveis]
  for (let i = livres.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[livres[i], livres[j]] = [livres[j], livres[i]]
  }
  const retirar = (imovel: Imovel) => retirarDe(livres, imovel)

  // Mantém a sequência do gerador usada pela versão anterior do seed, para não mudar os demais dados.
  for (let i = 0; i < 8; i++) rand()

  for (let i = 0; i < 8; i++) bloquear(retirar(livres[0]), i, agoraMs)
  for (const i of imoveis.filter((x) => x.situacao === 'vendido')) i.publicacao.catalogo = false


  // ===== Usuários e propostas =====
  // As duas primeiras propostas reproduzem o protótipo (Lote 12 com três versões e Lote 31 aguardando a diretoria);
  // as demais cobrem as outras situações. Não usam o gerador aleatório, para não alterar os dados seguintes.
  const usuarios: Usuario[] = [
    { id: 'usr-1', nome: 'Ayran Bade', email: 'admin@urbizzi.com.br', senha: 'urbizzi123', papel: 'Administrador' },
    { id: 'usr-2', nome: 'Matheus Oening', email: 'gestor@urbizzi.com.br', senha: 'urbizzi123', papel: 'Gestor comercial' },
    { id: 'usr-3', nome: 'Gabriela Krüger', email: 'gerente@urbizzi.com.br', senha: 'urbizzi123', papel: 'Gerente comercial' },
  ]
  const resp = (id: string) => {
    const u = usuarios.find((x) => x.id === id)!
    return { id: u.id, nome: u.nome, cargo: u.papel }
  }
  const descontoPara = (tabela: number, valor: number) => ((tabela - valor) / tabela) * 100

  // Alguns cadastros recentes para o indicador "este mês".
  for (let i = 0; i < 6; i++) {
    const em = new Date(inicioMes + rand() * Math.max(agoraMs - inicioMes, HORA)).toISOString()
    livres[i].criadoEm = em
    livres[i].atualizadoEm = em
  }

  // ===== Loteamentos e quadras =====
  const loteamentos: Loteamento[] = LOTEAMENTOS.map((l, i) => ({
    id: `lot-${i + 1}`,
    nome: l.nome,
    codigo: l.codigo,
    situacao: 'em_comercializacao',
    dataAprovacao: `${ano - 2}-0${i + 3}-12`,
    cep: l.cep,
    endereco: l.endereco,
    bairro: l.bairro,
    cidade: l.cidade,
    uf: l.uf,
    matriculaMae: String(38771 + i * 1311),
    areaTotal: [182400, 96500, 118000, 54300][i],
    areaLoteavel: [121900, 61200, 72300, 35100][i],
    centro: l.centro,
    cartorio: '1º Ofício de Toledo',
    numeroRegistro: `R-${4 + i}/${38771 + i * 1311}`,
    licencaAmbiental: `IAT-${ano - 2}-0${871 + i}`,
    validadeLicenca: `${ano + 1}-06-30`,
    limiteRenovacoes: l.limiteRenovacoes,
  }))
  const quadras = gerarQuadras(imoveis)

  // ===== Interesses vindos do catálogo público =====
  const interesses: Interesse[] = []
  const novoInteresse = (imovel: Imovel, nome: string, diasAtras: number) => {
    interesses.push({
      id: `int-${interesses.length + 1}`,
      codigo: `INT-${pad4(4471 - interesses.length)}`,
      imovelId: imovel.id,
      nome,
      email: `${nome.split(' ')[0].toLowerCase()}@email.com`,
      telefone: '(45) 99812-4477',
      mensagem: 'Gostaria de saber as condições de parcelamento e a documentação do lote.',
      criadoEm: new Date(agoraMs - diasAtras * DIA).toISOString(),
    })
  }
  const lote12 = criarLoteExtra(imoveis, 'a1', 'a2', 'a3');
  novoInteresse(lote12, 'Marina Ferreira Duarte', 49)
  for (const n of NOMES_INTERESSE.slice(1, 4)) novoInteresse(lote12, n, 10 + interesses.length * 3)
  for (const imovel of imoveis.filter((i) => i !== lote12)) {
    interessesDoImovel(imovel, rand, escolher, (nome, dias) => novoInteresse(imovel, nome, dias))
  }

  // ===== Histórico (somente leitura) =====
  const nomeCliente = (id: string) => clientes.find((c) => c.id === id)?.nome ?? 'cliente'
  const nomeCorretor = (id: string) => corretores.find((c) => c.id === id)?.nome ?? 'Sistema'
  const autores = ['Arthur Pacheco', 'Matheus Oening', 'Gustavo Marques', 'Gabriela Krüger']
  const diasAtras = (d: number) => new Date(agoraMs - d * DIA).toISOString()
  const historico = montarHistorico({ imoveis, loteamentos, interesses, lote12, autores, escolher, nomeCliente, nomeCorretor, diasAtras, agoraMs })

  // ===== Cadastro comercial dos clientes (RF11, RF12) =====
  completarCadastroComercial(clientes, { imoveis, nomeCorretor, responsaveis: ['Ayran Bade', ...autores], agoraMs })

  // ===== Documentos =====
  const documentos: Documento[] = []
  const doc = (d: Omit<Documento, 'id' | 'imovelId'>, imovel = lote12) =>
    documentos.push({ id: `doc-${documentos.length + 1}`, imovelId: imovel.id, ...d })
  const emDias = (d: number) => new Date(agoraMs + d * DIA).toISOString().slice(0, 10)
  const m = lote12.matricula
  doc({ tipo: 'Matrícula', arquivo: `matricula-${m}-v1.pdf`, tamanho: 1_200_000, versao: 1, enviadoPor: 'Arthur Pacheco', data: diasAtras(560), visivelCatalogo: false, substituido: true })
  doc({ tipo: 'Planta do lote', arquivo: 'planta-uni-i-qd04-l12.dwg', tamanho: 5_400_000, versao: 1, enviadoPor: 'Gabriela Krüger', data: diasAtras(560), visivelCatalogo: true, substituido: false })
  doc({ tipo: 'Licença ambiental', arquivo: `iat-${ano - 2}-0871.pdf`, tamanho: 800_000, versao: 1, enviadoPor: 'Matheus Oening', data: diasAtras(559), validade: emDias(300), visivelCatalogo: false, substituido: false })
  doc({ tipo: 'Matrícula atualizada', arquivo: `matricula-${m}-v2.pdf`, tamanho: 1_400_000, versao: 2, enviadoPor: 'Arthur Pacheco', data: diasAtras(490), validade: emDias(640), visivelCatalogo: false, substituido: false })
  doc({ tipo: 'Fotos do lote', arquivo: 'fotos-l12.zip', tamanho: 8_900_000, versao: 3, enviadoPor: 'Gustavo Marques', data: diasAtras(49), visivelCatalogo: true, substituido: false })
  for (const imovel of imoveis.filter((i) => i !== lote12)) {
    doc({ tipo: 'Matrícula', arquivo: `matricula-${imovel.matricula}.pdf`, tamanho: 900_000, versao: 1, enviadoPor: escolher(autores), data: imovel.criadoEm, visivelCatalogo: false, substituido: false }, imovel)
  }

  return {
    versao: VERSAO_DB,
    imoveis,
    clientes,
    corretores,
    usuarios,
    loteamentos,
    quadras,
    interesses,
    historico,
    documentos,
  }
}
