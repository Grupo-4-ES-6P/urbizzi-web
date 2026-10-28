import { LOTEAMENTOS, type LoteamentoInicial } from './catalogos'
import { CANAIS_CONTATO, ORIGENS_CLIENTE, ordenarContatos } from '../lib/clientes'
import { dataCalendario } from '../lib/format'
import type {
  Cliente,
  ContatoComercial,
  Db,
  Documento,
  EventoHistorico,
  Imovel,
  Interesse,
  Loteamento,
  Pessoa,
  Proposta,
  Quadra,
  Reserva,
  ResultadoContato,
  Venda,
} from './types'

// Sobe a cada mudança no formato dos dados para descartar o banco antigo salvo no navegador.
export const VERSAO_DB = 8

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

const PROFISSOES = ['Engenheira civil', 'Professor', 'Médica', 'Advogado', 'Comerciante', 'Agricultor', 'Analista de sistemas', 'Enfermeira', 'Contador', 'Arquiteta']
const ESTADOS_CIVIS = ['Solteiro(a)', 'Casado(a)', 'Casado(a)', 'Divorciado(a)', 'União estável']
const RUAS_CLIENTES = ['Rua Barão do Rio Branco', 'Av. Parigot de Souza', 'Rua Sarandi', 'Rua Guarani', 'Av. Maripá', 'Rua São João', 'Rua Rui Barbosa']
const BAIRROS_CLIENTES = ['Centro', 'Jardim Gisela', 'Vila Industrial', 'Jardim La Salle', 'Vila Becker', 'Jardim Porto Alegre']
const CLIENTES_INATIVOS = new Set(['Sílvia Menegatti', 'Paulo Rinaldi'])

const NOMES_CORRETORES = ['J. Biló', 'D. Krüger', 'M. Oening', 'A. Pacheco', 'G. Lima']

const RUAS: Record<string, string[]> = {
  'Lot. Universitário': ['Rua das Acácias', 'Rua dos Ipês', 'Rua Universitária'],
  'Jd. Europa': ['Rua Lisboa', 'Rua Madri', 'Rua Viena'],
  'Biopark Toledo': ['Av. Ministro Cirne Lima'],
  'Jd. Porto Alegre': ['Rua Guaíba', 'Rua Farroupilha'],
}

const CONDICOES = ['À vista', 'Entrada 20% + 36x', 'Financiamento bancário', 'Entrada 40% + 12x']

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

type Aleatorio = () => number

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
    ativo: !CLIENTES_INATIVOS.has(nome),
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


const PLANOS: { lot: LoteamentoInicial; quadras: number; lotes: number }[] = [
  { lot: LOTEAMENTOS[0], quadras: 6, lotes: 12 },
  { lot: LOTEAMENTOS[1], quadras: 9, lotes: 8 },
  { lot: LOTEAMENTOS[2], quadras: 0, lotes: 44 },
  { lot: LOTEAMENTOS[3], quadras: 3, lotes: 10 },
]

interface PosicaoLote {
  lot: LoteamentoInicial
  quadra: string
  qi: number
  quadras: number
  l: number
  lotes: number
}

function criarImovel(rand: Aleatorio, agoraMs: number, codigo: number, indice: number, p: PosicaoLote): Imovel {
  const escolher = <T,>(lista: T[]) => lista[Math.floor(rand() * lista.length)]
  const { lot, quadra, qi, quadras, l, lotes } = p
  const grande = lot.nome === 'Biopark Toledo'
  const frente = grande ? 26 : escolher([12, 12.5, 13, 14, 15])
  const fundo = grande ? 50 : escolher([25, 28, 30])
  const area = frente * fundo
  const tabela = arredondar(area * lot.precoM2 * (0.95 + rand() * 0.1))
  const criadoEm = new Date(agoraMs - (40 + Math.floor(rand() * 360)) * DIA).toISOString()
  const areaTexto = area.toLocaleString('pt-BR')
  return {
    id: `imo-${codigo}`,
    codigo: String(codigo),
    titulo: grande ? `Terreno Biopark ${areaTexto}m²` : `Terreno ${areaTexto}m² — ${lot.nome}`,
    matricula: String(40000 + indice * 7),
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
  }
}

function gerarImoveis(rand: Aleatorio, agoraMs: number) {
  const imoveis: Imovel[] = []
  let codigo = 7700
  for (const { lot, quadras, lotes } of PLANOS) {
    const listaQuadras = quadras === 0 ? [''] : Array.from({ length: quadras }, (_, i) => pad(i + 1))
    listaQuadras.forEach((quadra, qi) => {
      for (let l = 1; l <= lotes; l++) {
        codigo += 1
        imoveis.push(criarImovel(rand, agoraMs, codigo, imoveis.length, { lot, quadra, qi, quadras, l, lotes }))
      }
    })
  }
  return imoveis
}

interface Contexto {
  rand: Aleatorio
  escolher: <T>(lista: T[]) => T
  agora: Date
  agoraMs: number
  inicioMes: number
  ano: number
  imoveis: Imovel[]
  clientes: Cliente[]
  corretores: Pessoa[]
}

const AUTORES = ['Arthur Pacheco', 'Matheus Oening', 'Gustavo Marques', 'Gabriela Krüger']

/** Data da i-ésima venda: as três primeiras no mês atual, depois espalhadas no ano. */
function dataDaVenda({ rand, agora, agoraMs, inicioMes }: Contexto, i: number) {
  if (i < 3) return inicioMes + rand() * Math.max(agoraMs - inicioMes, HORA)
  const mesesAtras = i < 6 ? 1 : 2 + Math.floor(rand() * 10)
  const ref = new Date(agora.getFullYear(), agora.getMonth() - mesesAtras, 1)
  return ref.getTime() + rand() * 27 * DIA
}

// Vendas dos últimos 12 meses.
function criarVendas(ctx: Contexto, retirar: (i: Imovel) => Imovel, livres: Imovel[]) {
  const { rand, escolher, ano, agoraMs, clientes, corretores } = ctx
const vendas: Venda[] = []
for (let i = 0; i < 60; i++) {
  const imovel = retirar(livres[0])
  imovel.situacao = 'vendido'
  const data = dataDaVenda(ctx, i)
  vendas.push({
    id: `ven-${i + 1}`,
    codigo: `VD-${ano}-${pad4(92 - i)}`,
    status: 'ativa',
    imovelId: imovel.id,
    clienteId: escolher(clientes).id,
    corretorId: corretores[i % corretores.length].id,
    valor: arredondar(imovel.valores.tabela! * (0.95 + rand() * 0.05)),
    data: new Date(Math.min(data, agoraMs)).toISOString(),
  })
}
  return vendas
}

const BLOQUEIOS = [
  { motivo: 'Faixa de serviço / área técnica', justificativa: 'Área reservada para passagem de rede.' },
  { motivo: 'Pendência de averbação', justificativa: 'A averbação da unidade ainda não saiu no cartório.' },
]

function bloquearAlguns(retirar: (i: Imovel) => Imovel, livres: Imovel[], agoraMs: number) {
  for (let i = 0; i < 8; i++) {
    const imovel = retirar(livres[0])
    imovel.situacao = 'bloqueado'
    imovel.publicacao.catalogo = false
    imovel.bloqueio = { ...BLOQUEIOS[i % 3 === 0 ? 0 : 1], em: new Date(agoraMs - (20 + i * 9) * DIA).toISOString() }
  }
}

function criarLoteamentosEQuadras(imoveis: Imovel[], ano: number) {
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
  return { loteamentos, quadras }
}

function criarInteresses(ctx: Contexto, lote12: Imovel) {
  const { rand, escolher, agoraMs, imoveis } = ctx
// ===== Interesses vindos do catálogo público =====
const NOMES_INTERESSE = ['Marina Ferreira Duarte', 'Carlos Menezes', 'Fernanda Lopes', 'João Ribeiro', 'Priscila Nogueira', 'Henrique Dalla']
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
novoInteresse(lote12, 'Marina Ferreira Duarte', 49)
for (const n of NOMES_INTERESSE.slice(1, 4)) novoInteresse(lote12, n, 10 + interesses.length * 3)
for (const imovel of imoveis) {
  if (imovel === lote12 || imovel.situacao === 'bloqueado' || rand() > 0.35) continue
  const qtd = 1 + Math.floor(rand() * 6)
  for (let k = 0; k < qtd; k++) novoInteresse(imovel, escolher(NOMES_INTERESSE), 1 + Math.floor(rand() * 90))
}
  return interesses
}

interface Extras {
  loteamentos: Loteamento[]
  interesses: Interesse[]
  lote12: Imovel
}

function criarHistorico(
  ctx: Contexto & { reservas: Reserva[]; propostas: Proposta[]; vendas: Venda[] },
  { loteamentos, interesses, lote12 }: Extras,
) {
  const { escolher, agoraMs, imoveis, clientes, corretores, reservas, propostas, vendas } = ctx
// ===== Histórico (somente leitura) =====
const historico: EventoHistorico[] = []
const evento = (e: Omit<EventoHistorico, 'id'>) => historico.push({ id: `his-${historico.length + 1}`, ...e })
const nomeCliente = (id: string) => clientes.find((c) => c.id === id)?.nome ?? 'cliente'
const nomeCorretor = (id: string) => corretores.find((c) => c.id === id)?.nome ?? 'Sistema'
const autores = ['Arthur Pacheco', 'Matheus Oening', 'Gustavo Marques', 'Gabriela Krüger']
for (const imovel of imoveis) {
  const lot = loteamentos.find((l) => l.nome === imovel.loteamento)!
  evento({
    imovelId: imovel.id,
    data: imovel.criadoEm,
    tipo: 'Cadastro',
    descricao: imovel.endereco.quadra ? `Lote criado na geração da Qd. ${imovel.endereco.quadra}` : 'Lote cadastrado',
    autor: escolher(autores),
    referencia: lot.codigo,
    situacao: { rotulo: 'Disponível', variante: 'normal' },
  })
  if (imovel.bloqueio) {
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
// Linha do tempo detalhada do Lote 12 — Qd. 04 (reproduz o protótipo).
const diasAtras = (d: number) => new Date(agoraMs - d * DIA).toISOString()
const valorLote12 = lote12.valores.tabela!.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
lote12.criadoEm = diasAtras(620)
historico.find((e) => e.imovelId === lote12.id && e.tipo === 'Cadastro')!.data = lote12.criadoEm
evento({ imovelId: lote12.id, data: diasAtras(600), tipo: 'Alteração', descricao: `Valor de tabela ajustado para ${valorLote12}`, autor: 'Matheus Oening', situacao: { rotulo: 'Disponível', variante: 'normal' } })
evento({ imovelId: lote12.id, data: diasAtras(560), tipo: 'Bloqueio', descricao: 'Bloqueado por pendência de averbação', autor: 'Matheus Oening', situacao: { rotulo: 'Bloqueado', variante: 'escuro' } })
evento({ imovelId: lote12.id, data: diasAtras(490), tipo: 'Reabilitação', descricao: 'Averbação concluída; imóvel liberado para venda', autor: 'Matheus Oening', referencia: `R-6/${lote12.matricula}`, situacao: { rotulo: 'Disponível', variante: 'normal' } })
for (const it of interesses) {
  evento({ imovelId: it.imovelId, data: it.criadoEm, tipo: 'Interesse', descricao: 'Formulário recebido pelo catálogo público', autor: 'Sistema', referencia: it.codigo, situacao: { rotulo: 'Novo', variante: 'laranja' } })
}
for (const r of reservas) {
  evento({ imovelId: r.imovelId, data: r.criadaEm, tipo: 'Reserva', descricao: `Reserva criada para ${nomeCliente(r.clienteId)}`, autor: nomeCorretor(r.corretorId), referencia: r.codigo, situacao: { rotulo: 'Reservado', variante: 'atencao' } })
}
for (const p of propostas) {
  evento({ imovelId: p.imovelId, data: p.criadaEm, tipo: 'Proposta', descricao: 'Proposta enviada para aprovação', autor: nomeCorretor(p.corretorId), referencia: p.codigo, situacao: { rotulo: 'Em análise', variante: 'escuro' } })
}
for (const v of vendas) {
  evento({ imovelId: v.imovelId, data: v.data, tipo: 'Venda', descricao: `Venda registrada para ${nomeCliente(v.clienteId)}`, autor: escolher(autores), referencia: v.codigo, situacao: { rotulo: 'Vendido', variante: 'laranja' } })
}
evento({ imovelId: lote12.id, data: new Date(agoraMs - 2 * HORA).toISOString(), tipo: 'Sistema', descricao: 'Aviso de vencimento da reserva enviado ao responsável', autor: 'Sistema', situacao: { rotulo: 'Atenção', variante: 'atencao' } })
  return historico
}

function criarDocumentos(ctx: Contexto, lote12: Imovel, { reservas, propostas }: { reservas: Reserva[]; propostas: Proposta[] }) {
  const { escolher, agoraMs, ano, imoveis } = ctx
  const diasAtras = (d: number) => new Date(agoraMs - d * DIA).toISOString()
  const autores = AUTORES
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
doc({ tipo: 'Contrato de reserva', arquivo: `${reservas[0].codigo.toLowerCase()}.pdf`, tamanho: 300_000, versao: 1, enviadoPor: 'Gustavo Marques', data: diasAtras(46), visivelCatalogo: false, substituido: false })
doc({ tipo: 'Proposta assinada', arquivo: `${propostas[0].codigo.toLowerCase()}-v3.pdf`, tamanho: 200_000, versao: 1, enviadoPor: 'Gustavo Marques', data: diasAtras(36), visivelCatalogo: false, aguardandoAssinatura: true, substituido: false })
for (const imovel of imoveis) {
  if (imovel === lote12) continue
  doc({ tipo: 'Matrícula', arquivo: `matricula-${imovel.matricula}.pdf`, tamanho: 900_000, versao: 1, enviadoPor: escolher(autores), data: imovel.criadoEm, visivelCatalogo: false, substituido: false }, imovel)
}
  return documentos
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
  reservas: Reserva[]
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
function completarCadastroComercial(clientes: Cliente[], { reservas, imoveis, nomeCorretor, responsaveis, agoraMs }: ContextoCadastroComercial) {
  const rnd = mulberry32(20261016)
  const sortear = <T,>(lista: T[]) => lista[Math.floor(rnd() * lista.length)]
  const chance = (p: number) => rnd() < p
  const origensComuns = ORIGENS_CLIENTE.filter((o) => o !== 'Parceiro')
  for (const c of clientes) {
    const reservaCliente = reservas.find((r) => r.clienteId === c.id)
    const juridica = c.tipoPessoa === 'juridica'
    c.rg = documentoSecundario(juridica, rnd)
    c.celular = c.telefone
    c.telefone = chance(0.4) ? `(45) 3${pad(Math.floor(rnd() * 100))}${Math.floor(rnd() * 10)}-${pad4(Math.floor(rnd() * 10000))}` : ''
    c.origem = juridica && chance(0.5) ? 'Parceiro' : sortear(origensComuns)
    c.responsavel = reservaCliente ? nomeCorretor(reservaCliente.corretorId) : sortear(responsaveis)
    c.imovelInteresseId = reservaCliente?.imovelId ?? (chance(0.7) ? sortear(imoveis).id : '')
    const qtd = Math.floor(rnd() * 5)
    c.contatos = ordenarContatos(
      Array.from({ length: qtd }, (_, k): ContatoComercial => ({
        id: `ctt-${c.id}-${k + 1}`,
        data: dataCalendario(new Date(agoraMs - (1 + Math.floor(rnd() * 90)) * DIA)),
        canal: sortear(CANAIS_CONTATO),
        responsavel: k === 0 ? c.responsavel : sortear(responsaveis),
        imovelId: chance(0.8) ? c.imovelInteresseId : '',
        assunto: sortear(ASSUNTOS_CONTATO),
        resultado: sortear(RESULTADOS_SEED),
      })),
    )
  }
}

export function criarSeed(agora: Date): Db {
  const rand = mulberry32(20260824)
  const escolher = <T,>(lista: T[]) => lista[Math.floor(rand() * lista.length)]
  const agoraMs = agora.getTime()
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).getTime()

  // Gerador separado para os dados cadastrais dos clientes: assim os demais dados não mudam.
  const rand2 = mulberry32(20261003)
  const clientes: Cliente[] = NOMES_CLIENTES.map((nome, i) => montarCliente(nome, i, rand2, agoraMs))
  const corretores: Pessoa[] = NOMES_CORRETORES.map((nome, i) => ({ id: `cor-${i + 1}`, nome }))
  const cliente = (nome: string) => clientes.find((c) => c.nome === nome)!.id
  const corretor = (nome: string) => corretores.find((c) => c.nome === nome)!.id

  const ano = agora.getFullYear()
  const imoveis = gerarImoveis(rand, agoraMs)
  const ctx: Contexto = { rand, escolher, agora, agoraMs, inicioMes, ano, imoveis, clientes, corretores }

  const achar = (loteamento: string, quadra: string, lote: string) =>
    imoveis.find(
      (i) => i.loteamento === loteamento && i.endereco.quadra === quadra && i.endereco.lote === lote,
    )!

  // Ordem embaralhada para distribuir as situações de forma determinística.
  const livres = [...imoveis]
  for (let i = livres.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[livres[i], livres[j]] = [livres[j], livres[i]]
  }
  const retirar = (imovel: Imovel) => {
    const idx = livres.indexOf(imovel)
    if (idx >= 0) livres.splice(idx, 1)
    return imovel
  }

  // Reservas ativas: as cinco primeiras reproduzem o protótipo.
  const reservas: Reserva[] = []
  const novaReserva = (imovel: Imovel, cli: string, cor: string, expiraEmMs: number) => {
    retirar(imovel)
    imovel.situacao = 'reservado'
    reservas.push({
      id: `res-${reservas.length + 1}`,
      codigo: `RES-${ano}-${pad4(184 - reservas.length)}`,
      imovelId: imovel.id,
      clienteId: cli,
      corretorId: cor,
      criadaEm: new Date(expiraEmMs - 7 * DIA).toISOString(),
      expiraEm: new Date(expiraEmMs).toISOString(),
      status: 'ativa',
    })
  }
  const destaque = [
    { imovel: achar('Lot. Universitário', '04', '12'), cli: 'Marina Alves', cor: 'J. Biló', em: 4 * HORA + 20 * 60_000 },
    { imovel: achar('Lot. Universitário', '02', '07'), cli: 'Rafael Nunes', cor: 'D. Krüger', em: 26 * HORA },
    { imovel: achar('Biopark Toledo', '', '31'), cli: 'Construtora ML', cor: 'M. Oening', em: 50 * HORA },
    { imovel: achar('Jd. Europa', '09', '08'), cli: 'Ana Paula S.', cor: 'A. Pacheco', em: 76 * HORA },
    { imovel: achar('Biopark Toledo', '', '44'), cli: 'Tiago Ferraz', cor: 'G. Lima', em: 122 * HORA },
  ]
  for (const d of destaque) novaReserva(d.imovel, cliente(d.cli), corretor(d.cor), agoraMs + d.em)
  for (let i = 0; i < 23; i++) {
    novaReserva(
      livres[0],
      escolher(clientes).id,
      escolher(corretores).id,
      agoraMs + (130 + Math.floor(rand() * 38)) * HORA,
    )
  }

  // Propostas pendentes: três abaixo da tabela (exigem aprovação do administrador).
  const propostas: Proposta[] = []
  const novaProposta = (imovel: Imovel, cli: string, cor: string, valor: number, condicao?: string) => {
    propostas.push({
      id: `pro-${propostas.length + 1}`,
      codigo: `PROP-${ano}-${pad4(311 - propostas.length)}`,
      imovelId: imovel.id,
      clienteId: cli,
      corretorId: cor,
      valor,
      condicao,
      status: 'pendente',
      criadaEm: new Date(agoraMs - (1 + propostas.length) * 5 * HORA).toISOString(),
    })
  }
  const [r31, r07, r44] = [destaque[2].imovel, destaque[1].imovel, destaque[4].imovel]
  novaProposta(r31, cliente('Construtora ML'), corretor('M. Oening'), arredondar(r31.valores.tabela! * 0.92, 1000))
  novaProposta(r07, cliente('Rafael Nunes'), corretor('D. Krüger'), arredondar(r07.valores.tabela! * 0.95, 500), 'Entrada 30% + 24x')
  novaProposta(r44, cliente('Tiago Ferraz'), corretor('G. Lima'), arredondar(r44.valores.tabela! * 0.97, 1000), 'À vista')
  const reservadosRestantes = reservas.slice(5, 13)
  for (const r of reservadosRestantes) {
    const imovel = imoveis.find((i) => i.id === r.imovelId)!
    novaProposta(imovel, r.clienteId, r.corretorId, imovel.valores.tabela!, escolher(CONDICOES))
  }

  const vendas = criarVendas(ctx, retirar, livres)

  bloquearAlguns(retirar, livres, agoraMs)
  for (const i of imoveis) if (i.situacao === 'vendido') i.publicacao.catalogo = false

  // Alguns cadastros recentes para o indicador "este mês".
  for (let i = 0; i < 6; i++) {
    const em = new Date(inicioMes + rand() * Math.max(agoraMs - inicioMes, HORA)).toISOString()
    livres[i].criadoEm = em
    livres[i].atualizadoEm = em
  }

  const lote12 = destaque[0].imovel
  const { loteamentos, quadras } = criarLoteamentosEQuadras(imoveis, ano)
  const interesses = criarInteresses(ctx, lote12)
  const historico = criarHistorico({ ...ctx, reservas, propostas, vendas }, { loteamentos, interesses, lote12 })
  const documentos = criarDocumentos(ctx, lote12, { reservas, propostas })

  // ===== Cadastro comercial dos clientes (RF11, RF12) =====
  // Compradores entram depois do sorteio das vendas para não mudar a distribuição dos dados acima.
  const rand3 = mulberry32(20260812)
  for (const nome of NOMES_COMPRADORES) clientes.push(montarCliente(nome, clientes.length, rand3, agoraMs))
  const nomeCorretor = (id: string) => corretores.find((c) => c.id === id)?.nome ?? 'Sistema'
  completarCadastroComercial(clientes, { reservas, imoveis, nomeCorretor, responsaveis: ['Ayran Bade', ...AUTORES], agoraMs })

  return {
    versao: VERSAO_DB,
    imoveis,
    clientes,
    corretores,
    reservas,
    propostas,
    vendas,
    usuarios: [
      {
        id: 'usr-1',
        nome: 'Ayran Bade',
        email: 'admin@urbizzi.com.br',
        senha: 'urbizzi123',
        papel: 'Administrador',
      },
    ],
    loteamentos,
    quadras,
    interesses,
    historico,
    documentos,
  }
}
