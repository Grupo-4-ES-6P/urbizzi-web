import { LOTEAMENTOS, type LoteamentoInicial } from './catalogos'
import { formatarMoedaInteira } from '../lib/format'
import {
  acimaDaAlcada,
  calcularCondicoes,
  descreverMudancas,
  exigeDiretoria,
  formatarParcelas,
  instanteExpiracaoProposta,
  montarEtapas,
} from '../lib/propostas'
import { dataCalendario } from '../lib/reservas'
import { instanteDaVenda } from '../lib/vendas'
import type {
  Cliente,
  CondicoesProposta,
  EtapaAprovacao,
  EventoProposta,
  EventoVenda,
  StatusVenda,
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
  Reserva,
  Venda,
} from './types'

export const VERSAO_DB = 5

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
    a |= 0
    a = (a + 0x6d2b79f5) | 0
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

export function criarSeed(agora: Date): Db {
  const rand = mulberry32(20260824)
  const escolher = <T,>(lista: T[]) => lista[Math.floor(rand() * lista.length)]
  const agoraMs = agora.getTime()
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).getTime()

  // Gerador separado para clientes e reservas encerradas: assim os demais dados não mudam.
  const rand2 = mulberry32(20261003)
  const escolher2 = <T,>(lista: T[]) => lista[Math.floor(rand2() * lista.length)]
  const fimDoDia = (ms: number) => {
    const d = new Date(ms)
    d.setHours(23, 59, 59, 999)
    return d.getTime()
  }

  const montarCliente = (nome: string, i: number, rnd: () => number): Cliente => {
    const sortear = <T,>(lista: T[]) => lista[Math.floor(rnd() * lista.length)]
    const juridica = PREFIXOS_JURIDICA.some((p) => nome.startsWith(p))
    const usuarioEmail = nome
      .normalize('NFD')
      .replace(/[\u0300-\u036f.]/g, '')
      .toLowerCase()
      .split(/\s+/)
      .join('.')
    const criadoEm = new Date(agora.getTime() - (400 + Math.floor(rnd() * 400)) * DIA).toISOString()
    return {
      id: `cli-${i + 1}`,
      nome,
      tipoPessoa: juridica ? 'juridica' : 'fisica',
      cpfCnpj: juridica ? gerarCnpj(rnd) : gerarCpf(rnd),
      dataNascimento: juridica
        ? ''
        : `${1960 + Math.floor(rnd() * 40)}-${pad(1 + Math.floor(rnd() * 12))}-${pad(1 + Math.floor(rnd() * 28))}`,
      estadoCivil: juridica ? '' : sortear(ESTADOS_CIVIS),
      profissao: juridica ? '' : sortear(PROFISSOES),
      telefone: `(45) 9${8800 + Math.floor(rnd() * 1199)}-${pad4(Math.floor(rnd() * 10000))}`,
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
      criadoEm,
      atualizadoEm: criadoEm,
    }
  }
  const clientes: Cliente[] = NOMES_CLIENTES.map((nome, i) => montarCliente(nome, i, rand2))
  // Compradores do prot\u00f3tipo de vendas, com gerador pr\u00f3prio para n\u00e3o alterar os clientes acima.
  const rand3 = mulberry32(20260812)
  for (const nome of NOMES_COMPRADORES) clientes.push(montarCliente(nome, clientes.length, rand3))
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
  const retirar = (imovel: Imovel) => {
    const idx = livres.indexOf(imovel)
    if (idx >= 0) livres.splice(idx, 1)
    return imovel
  }

  // ===== Vendas =====
  // As oito primeiras reproduzem o protótipo; as demais completam o ano. Três lotes do protótipo
  // não existem na geração acima (Qd. 05 só vai até o Lote 12, Jd. Europa até o 08, Biopark até o 44)
  // e são criados aqui, fora da lista de livres, para não alterar o sorteio dos demais.
  const loteExtra = (loteamento: string, quadra: string, lote: string) => {
    const base = imoveis.find((i) => i.loteamento === loteamento && i.endereco.quadra === quadra) ?? imoveis.find((i) => i.loteamento === loteamento)!
    codigo += 1
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
  const VENDAS_SEED: { imovel: Imovel; comprador: string; corretor: string; valor: number; data: string; status: StatusVenda; justificativa?: string }[] = [
    { imovel: achar('Jd. Europa', '07', '03'), comprador: 'Silvana Costa', corretor: 'G. Krüger', valor: 268_000, data: '2026-08-12', status: 'concluida' },
    { imovel: loteExtra('Lot. Universitário', '05', '21'), comprador: 'Marcos Antunes', corretor: 'J. Biló', valor: 205_000, data: '2026-08-04', status: 'concluida' },
    { imovel: achar('Biopark Toledo', '', '15'), comprador: 'Incorp. Vertice', corretor: 'M. Oening', valor: 512_000, data: '2026-07-29', status: 'em_escritura' },
    { imovel: achar('Lot. Universitário', '03', '08'), comprador: 'Priscila Damo', corretor: 'A. Pacheco', valor: 176_500, data: '2026-07-22', status: 'concluida' },
    { imovel: loteExtra('Jd. Europa', '', '39'), comprador: 'Eduardo Reck', corretor: 'G. Lima', valor: 244_000, data: '2026-07-15', status: 'cancelada', justificativa: 'Financiamento negado pelo banco; distrato assinado pelo comprador.' },
    { imovel: achar('Lot. Universitário', '01', '02'), comprador: 'Fernanda Luz', corretor: 'G. Krüger', valor: 168_000, data: '2026-07-08', status: 'concluida' },
    { imovel: loteExtra('Biopark Toledo', '', '47'), comprador: 'Construtora ML', corretor: 'M. Oening', valor: 489_000, data: '2026-06-30', status: 'concluida' },
    { imovel: achar('Lot. Universitário', '06', '11'), comprador: 'Ricardo Sesc', corretor: 'J. Biló', valor: 198_000, data: '2026-06-21', status: 'cancelada', justificativa: 'Comprador desistiu da compra após a escritura; distrato com devolução integral.' },
    { imovel: achar('Lot. Universitário', '02', '05'), comprador: 'Bruno Carvalho', corretor: 'D. Krüger', valor: 152_000, data: '2026-06-03', status: 'concluida' },
    { imovel: achar('Biopark Toledo', '', '22'), comprador: 'Gustavo Weber', corretor: 'M. Oening', valor: 498_000, data: '2026-05-19', status: 'concluida' },
    { imovel: achar('Jd. Europa', '05', '04'), comprador: 'Juliana Rocha', corretor: 'A. Pacheco', valor: 171_000, data: '2026-04-30', status: 'concluida' },
    { imovel: achar('Jd. Porto Alegre', '02', '09'), comprador: 'Felipe Moraes', corretor: 'G. Lima', valor: 139_500, data: '2026-04-14', status: 'concluida' },
    { imovel: achar('Lot. Universitário', '01', '07'), comprador: 'Camila Duarte', corretor: 'J. Biló', valor: 158_000, data: '2026-03-27', status: 'concluida' },
    { imovel: achar('Biopark Toledo', '', '36'), comprador: 'Rodrigo Sartori', corretor: 'D. Krüger', valor: 471_000, data: '2026-03-11', status: 'concluida' },
    { imovel: achar('Jd. Europa', '08', '06'), comprador: 'Aline Becker', corretor: 'G. Krüger', valor: 182_000, data: '2026-02-20', status: 'concluida' },
    { imovel: achar('Biopark Toledo', '', '40'), comprador: 'Diego Hoffmann', corretor: 'M. Oening', valor: 476_000, data: '2026-01-29', status: 'concluida' },
    { imovel: achar('Jd. Porto Alegre', '01', '03'), comprador: 'Lucas Pereira', corretor: 'A. Pacheco', valor: 143_000, data: '2026-01-13', status: 'concluida' },
  ]
  let seqEventoVenda = 0
  const evv = (tipo: EventoVenda['tipo'], ms: number, autor: string, statusAnterior: StatusVenda | null, status: StatusVenda, detalhe: string): EventoVenda => ({
    id: `evv-${++seqEventoVenda}`,
    tipo,
    data: new Date(Math.min(ms, agoraMs)).toISOString(),
    autor,
    statusAnterior,
    status,
    detalhe,
  })
  const vendas: Venda[] = VENDAS_SEED.map((s, i) => {
    const imovel = retirar(s.imovel)
    // Valor de venda ~3% abaixo da tabela, coerente com o desconto das propostas.
    const tabela = arredondar(s.valor * 1.03)
    imovel.valores = { ...imovel.valores, tabela, minimo: arredondar(tabela * 0.92) }
    imovel.publicacao.catalogo = false
    const data = instanteDaVenda(s.data)
    const dataMs = new Date(data).getTime()
    const historicoVenda = [evv('registro', dataMs, 'Matheus Oening', null, 'em_escritura', `Venda registrada · ${formatarMoedaInteira(s.valor)}`)]
    const cancelada = s.status === 'cancelada'
    // A primeira cancelada sai de Em escritura; a segunda, de Concluída (as duas origens permitidas).
    const concluiu = s.status === 'concluida' || (cancelada && i === 7)
    if (concluiu) historicoVenda.push(evv('conclusao', dataMs + 12 * DIA, 'Matheus Oening', 'em_escritura', 'concluida', 'Escritura concluída'))
    let cancelamento: Venda['cancelamento']
    if (cancelada) {
      const em = new Date(Math.min(dataMs + (concluiu ? 45 : 13) * DIA, agoraMs)).toISOString()
      cancelamento = { justificativa: s.justificativa!, em, autor: 'Ayran Bade' }
      const anterior = concluiu ? 'concluida' : 'em_escritura'
      historicoVenda.push(evv('cancelamento', new Date(em).getTime(), 'Ayran Bade', anterior, 'cancelada', `${concluiu ? 'Concluída' : 'Em escritura'} → Cancelada · ${s.justificativa}`))
      // RF24: o imóvel de uma venda cancelada fica bloqueado até ser reabilitado.
      imovel.situacao = 'bloqueado'
      imovel.bloqueio = { motivo: 'Venda cancelada', justificativa: s.justificativa!, em }
    } else {
      imovel.situacao = 'vendido'
    }
    return {
      id: `ven-${i + 1}`,
      codigo: `VD-2026-${pad4(92 - i)}`,
      imovelId: imovel.id,
      clienteId: cliente(s.comprador),
      corretorId: corretor(s.corretor),
      valor: s.valor,
      data,
      status: s.status,
      cancelamento,
      historico: historicoVenda,
    }
  })

  // Reservas ativas: as cinco primeiras reproduzem o protótipo.
  const reservas: Reserva[] = []
  const limiteRenovacoes = (loteamento: string) => LOTEAMENTOS.find((l) => l.nome === loteamento)?.limiteRenovacoes ?? 0
  /** Reserva com os campos comerciais preenchidos; o histórico começa com a criação. */
  const registrarReserva = (
    imovel: Imovel,
    cli: string,
    cor: string,
    criadaEmMs: number,
    validadeDias: number,
    expiraEmMs: number,
    status: Reserva['status'],
  ) => {
    const criadaEm = new Date(criadaEmMs).toISOString()
    const reserva: Reserva = {
      id: `res-${reservas.length + 1}`,
      codigo: `RES-${ano}-${pad4(184 - reservas.length)}`,
      imovelId: imovel.id,
      clienteId: cli,
      corretorId: cor,
      criadaEm,
      dataInicio: dataCalendario(new Date(criadaEmMs)),
      validadeDias,
      expiraEm: new Date(expiraEmMs).toISOString(),
      status,
      renovacoesUsadas: 0,
      renovacoesPermitidas: limiteRenovacoes(imovel.loteamento),
      avisarHorasAntes: 48,
      valorTabela: imovel.valores.tabela,
      sinal: null,
      formaPagamento: '',
      descontoPercentual: null,
      origemInteresse: '',
      contatoRecente: '',
      observacoes: '',
      atualizadaEm: criadaEm,
      historico: [
        {
          id: `evr-${reservas.length + 1}-1`,
          tipo: 'criacao',
          data: criadaEm,
          titulo: 'Reserva criada',
          autor: corretores.find((c) => c.id === cor)?.nome ?? 'Sistema',
          detalhe: `Validade de ${validadeDias} dias`,
          situacao: 'ativa',
        },
      ],
    }
    reservas.push(reserva)
    return reserva
  }
  const novaReserva = (imovel: Imovel, cli: string, cor: string, expiraEmMs: number) => {
    retirar(imovel)
    imovel.situacao = 'reservado'
    registrarReserva(imovel, cli, cor, expiraEmMs - 7 * DIA, 7, expiraEmMs, 'ativa')
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

  // Mantém a sequência do gerador usada pela versão anterior do seed, para não mudar os demais dados.
  for (let i = 0; i < 8; i++) rand()

  for (let i = 0; i < 8; i++) {
    const imovel = retirar(livres[0])
    imovel.situacao = 'bloqueado'
    imovel.publicacao.catalogo = false
    imovel.bloqueio = {
      motivo: i % 3 === 0 ? 'Faixa de serviço / área técnica' : 'Pendência de averbação',
      justificativa: i % 3 === 0 ? 'Área reservada para passagem de rede.' : 'A averbação da unidade ainda não saiu no cartório.',
      em: new Date(agoraMs - (20 + i * 9) * DIA).toISOString(),
    }
  }
  for (const i of imoveis) if (i.situacao === 'vendido') i.publicacao.catalogo = false

  // Reservas já encerradas (vendidas, expiradas e canceladas) para o módulo de reservas.
  const encerrar = (r: Reserva, e: Omit<Reserva['historico'][number], 'id'>) => {
    r.atualizadaEm = e.data
    r.historico.push({ id: `evr-${r.id.slice(4)}-2`, ...e })
  }
  // As vendas recentes não canceladas nasceram de reservas convertidas.
  for (const venda of vendas.slice(0, 8).filter((v) => v.status !== 'cancelada')) {
    const imovel = imoveis.find((i) => i.id === venda.imovelId)!
    const inicio = new Date(venda.data).getTime() - (5 + Math.floor(rand2() * 8)) * DIA
    const r = registrarReserva(imovel, venda.clienteId, venda.corretorId, inicio, 15, fimDoDia(inicio + 15 * DIA), 'convertida')
    encerrar(r, { tipo: 'conversao', data: venda.data, titulo: 'Reserva convertida em venda', autor: 'Sistema', detalhe: `Venda ${venda.codigo}`, situacao: 'convertida' })
    venda.reservaId = r.id
  }
  // Usa o fim da lista de livres para não mexer nos imóveis do indicador "este mês".
  for (let i = 0; i < 7; i++) {
    const imovel = livres[livres.length - 1 - i]
    const expirada = i < 4
    const inicio = agoraMs - (20 + Math.floor(rand2() * 40)) * DIA
    const validade = expirada ? 10 : 15
    const expira = fimDoDia(inicio + validade * DIA)
    const r = registrarReserva(imovel, escolher2(clientes).id, escolher2(corretores).id, inicio, validade, expira, expirada ? 'expirada' : 'cancelada')
    if (expirada) {
      encerrar(r, { tipo: 'expiracao', data: new Date(expira).toISOString(), titulo: 'Reserva expirada', autor: 'Sistema', detalhe: 'Sem renovação, o imóvel voltou para Disponível', situacao: 'expirada' })
    } else {
      const motivo = escolher2(['Desistência do cliente', 'Crédito não aprovado', 'Troca de imóvel'])
      encerrar(r, { tipo: 'cancelamento', data: new Date(inicio + 3 * DIA).toISOString(), titulo: 'Reserva cancelada', autor: r.historico[0].autor, detalhe: `${motivo} · imóvel liberado`, situacao: 'cancelada' })
    }
  }

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
  const iso = (ms: number) => new Date(ms).toISOString()
  const descontoPara = (tabela: number, valor: number) => ((tabela - valor) / tabela) * 100
  const propostas: Proposta[] = []
  let seqEventoProposta = 0
  const evp = (tipo: EventoProposta['tipo'], ms: number, titulo: string, autor: string, detalhe: string, versao: number): EventoProposta => ({
    id: `evp-${++seqEventoProposta}`,
    tipo,
    data: iso(ms),
    titulo,
    autor,
    detalhe,
    versao,
  })

  interface VersaoSeed {
    em: number
    autor: string
    desconto: number
    entrada: number
    parcelas: number
    aprovadorId: string
    indice?: string
    forma?: string
    escritura?: string
    garantia?: string
    validade?: number
    observacoes?: string
    anexos?: string[]
    comentario?: string
    rascunho?: boolean
  }
  /** Versões em ordem; todas, menos a última, ficam "Substituída". */
  const montarVersoes = (tabela: number, lista: VersaoSeed[], situacaoAtual: SituacaoVersao): VersaoProposta[] => {
    const versoes: VersaoProposta[] = []
    // O vencimento acordado é o mesmo em todas as versões, para não aparecer como mudança.
    const primeiroVencimento = dataCalendario(new Date(lista[0].em + 40 * DIA))
    lista.forEach((v, i) => {
      const condicoes: CondicoesProposta = {
        valorTabela: tabela,
        descontoPercentual: v.desconto,
        entrada: v.entrada,
        parcelas: v.parcelas,
        indiceCorrecao: v.indice ?? 'IGP-M',
        primeiroVencimento,
        formaPagamento: v.forma ?? 'Entrada + parcelamento',
        validadeDias: v.validade ?? 7,
        escritura: v.escritura ?? 'Após quitação',
        garantia: v.garantia ?? 'Alienação fiduciária',
      }
      versoes.push({
        numero: i + 1,
        criadaEm: iso(v.em),
        autor: v.autor,
        enviadaEm: v.rascunho ? undefined : iso(v.em),
        condicoes,
        acimaDaAlcada: acimaDaAlcada(v.desconto),
        aprovadorId: v.aprovadorId,
        observacoes: v.observacoes ?? '',
        anexos: v.anexos ?? [],
        oQueMudou: descreverMudancas(versoes[i - 1]?.condicoes, condicoes),
        comentario: v.comentario ?? '',
        situacao: i === lista.length - 1 ? situacaoAtual : 'substituida',
      })
    })
    return versoes
  }
  const registrarProposta = (
    reserva: Reserva,
    dados: Pick<Proposta, 'situacao' | 'versoes' | 'etapas' | 'historico'> & Partial<Pick<Proposta, 'decididaEm' | 'motivoRecusa'>>,
  ) => {
    const ultima = dados.versoes[dados.versoes.length - 1]
    const proposta: Proposta = {
      id: `pro-${propostas.length + 1}`,
      codigo: `PROP-${ano}-${pad4(311 - propostas.length)}`,
      reservaId: reserva.id,
      imovelId: reserva.imovelId,
      clienteId: reserva.clienteId,
      corretorId: reserva.corretorId,
      criadaEm: dados.versoes[0].criadaEm,
      atualizadaEm: dados.historico[dados.historico.length - 1].data,
      expiraEm: ultima.enviadaEm
        ? instanteExpiracaoProposta(dataCalendario(new Date(ultima.enviadaEm)), ultima.condicoes.validadeDias)
        : undefined,
      ...dados,
    }
    propostas.push(proposta)
    return proposta
  }
  const resumo = (v: VersaoProposta) => {
    const k = calcularCondicoes(v.condicoes)
    return `v${v.numero} · ${formatarMoedaInteira(k.valorProposto)} · ${formatarParcelas(v.condicoes.parcelas, k.valorParcela)}`
  }
  const comEstados = (etapas: EtapaAprovacao[], estados: Partial<Record<EtapaAprovacao['tipo'], [EtapaAprovacao['estado'], number?]>>) =>
    etapas.map((e) => {
      const novo = estados[e.tipo]
      return novo ? { ...e, estado: novo[0], concluidaEm: novo[1] === undefined ? e.concluidaEm : iso(novo[1]) } : e
    })

  // PROP-0311 — Lote 12, Qd. 04: três versões, em análise com o gestor (fora da alçada do usuário logado).
  {
    const reserva = reservas[0]
    const tabela = 455_000
    const [t1, t2, t3, t4] = [agoraMs - 6 * DIA, agoraMs - 4 * DIA, agoraMs - 2 * DIA, agoraMs - 1 * DIA]
    const anexos = ['proposta-lote12.pdf', 'simulacao-120x.xlsx', 'rg-cpf-cliente.pdf']
    const observacoes = 'Cliente pediu simulação alternativa em 120x. Visita realizada no lote.'
    const versoes = montarVersoes(
      tabela,
      [
        { em: t1, autor: 'Ayran Bade', desconto: 0, entrada: 136_500, parcelas: 18, aprovadorId: 'usr-2', observacoes, anexos: anexos.slice(0, 1) },
        { em: t2, autor: 'Gustavo Marques', desconto: 0, entrada: 136_500, parcelas: 24, aprovadorId: 'usr-2', observacoes, anexos: anexos.slice(0, 2) },
        { em: t3, autor: 'Gustavo Marques', desconto: 3, entrada: 88_270, parcelas: 24, aprovadorId: 'usr-2', observacoes, anexos, forma: 'Entrada + financiamento direto', comentario: 'Cliente aceita fechar com 3% de desconto.' },
      ],
      'em_analise',
    )
    registrarProposta(reserva, {
      situacao: 'em_analise',
      versoes,
      etapas: montarEtapas({ autor: 'Gustavo Marques', enviadaEm: iso(t3), aprovador: resp('usr-2') }),
      historico: [
        evp('criacao', t1, 'Proposta criada', 'Ayran Bade', `A partir da reserva ${reserva.codigo}`, 1),
        evp('envio', t1, 'Enviada para aprovação', 'Ayran Bade', resumo(versoes[0]), 1),
        evp('nova_versao', t2, 'Nova versão enviada', 'Gustavo Marques', `v2 · ${versoes[1].oQueMudou}`, 2),
        evp('nova_versao', t3, 'Nova versão enviada', 'Gustavo Marques', `v3 · ${versoes[2].oQueMudou} · desconto acima da alçada`, 3),
        evp('analise', t4, 'Em análise', 'Matheus Oening', 'Gestor solicitou comparação com o Jd. Europa', 3),
      ],
    })
  }

  // PROP-0310 — Lote 31, Biopark: no valor mínimo, aguardando a diretoria (usuário logado).
  {
    const reserva = reservas[2]
    const tabela = 455_000
    const [t1, t2, t3] = [agoraMs - 3 * DIA, agoraMs - 2 * DIA, agoraMs - 1 * DIA + 2 * HORA]
    const base = { autor: 'Matheus Oening', parcelas: 24, aprovadorId: 'usr-3', indice: 'INCC mensal', escritura: 'Após 12ª parcela', observacoes: 'Cliente já adquiriu dois lotes na quadra 12 em 2025. Solicita desconto para fechar os dois lotes remanescentes ainda neste trimestre.' }
    const versoes = montarVersoes(
      tabela,
      [
        { ...base, em: t1, desconto: descontoPara(tabela, 435_000), entrada: 130_500 },
        { ...base, em: t2, desconto: descontoPara(tabela, 420_000), entrada: 126_000, comentario: 'Valor revisado a pedido do cliente.' },
      ],
      'em_analise',
    )
    const etapas = comEstados(
      montarEtapas({ autor: 'Matheus Oening', enviadaEm: iso(t2), aprovador: resp('usr-3'), diretoria: resp('usr-1') }),
      { analise_comercial: ['concluida', t3], diretoria: ['aguardando'] },
    )
    registrarProposta(reserva, {
      situacao: 'aguardando_diretoria',
      versoes,
      etapas,
      historico: [
        evp('criacao', t1, 'Proposta criada', 'Matheus Oening', `A partir da reserva ${reserva.codigo}`, 1),
        evp('envio', t1, 'Enviada para aprovação', 'Matheus Oening', resumo(versoes[0]), 1),
        evp('nova_versao', t2, 'Nova versão enviada', 'Matheus Oening', `v2 · Valor revisado: R$ 435.000 → R$ 420.000`, 2),
        evp('aprovacao_etapa', t3, 'Análise comercial aprovada', 'Gabriela Krüger', 'Aprovada com ressalva: cliente recorrente · encaminhada para aprovação da diretoria', 2),
      ],
    })
  }

  // PROP-0309 — Lote 07, Qd. 02: dentro da alçada, recém-enviada para análise do usuário logado.
  {
    const reserva = reservas[1]
    const tabela = imoveis.find((i) => i.id === reserva.imovelId)!.valores.tabela!
    const t1 = agoraMs - 5 * HORA
    const valor = arredondar(tabela * 0.985, 500)
    const versoes = montarVersoes(
      tabela,
      [{ em: t1, autor: 'D. Krüger', desconto: descontoPara(tabela, valor), entrada: arredondar(valor * 0.3, 10), parcelas: 24, aprovadorId: 'usr-1' }],
      'em_analise',
    )
    registrarProposta(reserva, {
      situacao: 'enviada',
      versoes,
      etapas: montarEtapas({ autor: 'D. Krüger', enviadaEm: iso(t1), aprovador: resp('usr-1') }),
      historico: [
        evp('criacao', t1 - HORA, 'Proposta criada', 'D. Krüger', `A partir da reserva ${reserva.codigo}`, 1),
        evp('envio', t1, 'Enviada para aprovação', 'D. Krüger', resumo(versoes[0]), 1),
      ],
    })
  }

  // PROP-0308 — Lote 44, Biopark: recusada na análise comercial; a reserva continua ativa.
  {
    const reserva = reservas[4]
    const tabela = imoveis.find((i) => i.id === reserva.imovelId)!.valores.tabela!
    const [t1, t2] = [agoraMs - 4 * DIA, agoraMs - 3 * DIA]
    const versoes = montarVersoes(
      tabela,
      [{ em: t1, autor: 'G. Lima', desconto: 4, entrada: arredondar(tabela * 0.1, 10), parcelas: 120, aprovadorId: 'usr-2', forma: 'Entrada + financiamento direto' }],
      'recusada',
    )
    const motivo = 'Parcelamento em 120x fora da política para lotes comerciais.'
    registrarProposta(reserva, {
      situacao: 'recusada',
      decididaEm: iso(t2),
      motivoRecusa: motivo,
      versoes,
      etapas: comEstados(montarEtapas({ autor: 'G. Lima', enviadaEm: iso(t1), aprovador: resp('usr-2') }), { analise_comercial: ['recusada', t2] }),
      historico: [
        evp('criacao', t1, 'Proposta criada', 'G. Lima', `A partir da reserva ${reserva.codigo}`, 1),
        evp('envio', t1, 'Enviada para aprovação', 'G. Lima', resumo(versoes[0]), 1),
        evp('recusa', t2, 'Proposta recusada', 'Matheus Oening', `Análise comercial: ${motivo}`, 1),
      ],
    })
  }

  // PROP-0307 — contraproposta do gestor aguardando a resposta do cliente.
  {
    const reserva = reservas[5]
    const tabela = imoveis.find((i) => i.id === reserva.imovelId)!.valores.tabela!
    const [t1, t2] = [agoraMs - 2 * DIA, agoraMs - 20 * HORA]
    const corretor = corretores.find((c) => c.id === reserva.corretorId)!.nome
    const versoes = montarVersoes(
      tabela,
      [
        { em: t1, autor: corretor, desconto: 4, entrada: arredondar(tabela * 0.2, 10), parcelas: 36, aprovadorId: 'usr-2' },
        { em: t2, autor: 'Matheus Oening', desconto: 2.5, entrada: arredondar(tabela * 0.25, 10), parcelas: 36, aprovadorId: 'usr-2', comentario: 'Podemos chegar a 2,5% com entrada de 25%.' },
      ],
      'contraproposta',
    )
    registrarProposta(reserva, {
      situacao: 'contraproposta',
      versoes,
      etapas: montarEtapas({ autor: corretor, enviadaEm: iso(t1), aprovador: resp('usr-2') }),
      historico: [
        evp('criacao', t1, 'Proposta criada', corretor, `A partir da reserva ${reserva.codigo}`, 1),
        evp('envio', t1, 'Enviada para aprovação', corretor, resumo(versoes[0]), 1),
        evp('contraproposta', t2, 'Contraproposta', 'Matheus Oening', `v2 · ${versoes[1].oQueMudou}`, 2),
      ],
    })
  }

  // PROP-0306 — rascunho ainda não enviado.
  {
    const reserva = reservas[6]
    const tabela = imoveis.find((i) => i.id === reserva.imovelId)!.valores.tabela!
    const t1 = agoraMs - 3 * HORA
    const corretor = corretores.find((c) => c.id === reserva.corretorId)!.nome
    const versoes = montarVersoes(
      tabela,
      [{ em: t1, autor: corretor, desconto: 1, entrada: arredondar(tabela * 0.2, 10), parcelas: 12, aprovadorId: '', rascunho: true }],
      'rascunho',
    )
    registrarProposta(reserva, {
      situacao: 'rascunho',
      versoes,
      etapas: [],
      historico: [
        evp('criacao', t1, 'Proposta criada', corretor, `A partir da reserva ${reserva.codigo}`, 1),
        evp('rascunho', t1, 'Rascunho salvo', corretor, resumo(versoes[0]), 1),
      ],
    })
  }

  // PROP-0305 — enviada e nunca decidida: a validade passou e ela aparece como Expirada (RF21).
  {
    const reserva = reservas.find((r) => r.status === 'expirada')!
    const tabela = reserva.valorTabela!
    const t1 = new Date(reserva.criadaEm).getTime() + DIA
    const corretor = corretores.find((c) => c.id === reserva.corretorId)!.nome
    const versoes = montarVersoes(
      tabela,
      [{ em: t1, autor: corretor, desconto: 1.5, entrada: arredondar(tabela * 0.3, 10), parcelas: 24, aprovadorId: 'usr-2', validade: 3 }],
      'em_analise',
    )
    registrarProposta(reserva, {
      situacao: 'enviada',
      versoes,
      etapas: montarEtapas({ autor: corretor, enviadaEm: iso(t1), aprovador: resp('usr-2') }),
      historico: [
        evp('criacao', t1, 'Proposta criada', corretor, `A partir da reserva ${reserva.codigo}`, 1),
        evp('envio', t1, 'Enviada para aprovação', corretor, resumo(versoes[0]), 1),
      ],
    })
  }

  // PROP-0304 — aprovada: originou a venda mais recente e a conversão da reserva.
  {
    const reserva = reservas.find((r) => r.status === 'convertida')!
    const venda = vendas.find((v) => v.imovelId === reserva.imovelId)!
    const tabela = reserva.valorTabela!
    const fim = new Date(venda.data).getTime()
    const t1 = Math.max(new Date(reserva.criadaEm).getTime() + HORA, fim - 2 * DIA)
    const desconto = descontoPara(tabela, venda.valor)
    const corretor = corretores.find((c) => c.id === reserva.corretorId)!.nome
    const versoes = montarVersoes(
      tabela,
      [{ em: t1, autor: corretor, desconto, entrada: arredondar(venda.valor * 0.3, 10), parcelas: 24, aprovadorId: 'usr-2' }],
      'aprovada',
    )
    const diretoria = exigeDiretoria(desconto)
    const etapas = comEstados(
      montarEtapas({ autor: corretor, enviadaEm: iso(t1), aprovador: resp('usr-2'), diretoria: diretoria ? resp('usr-1') : undefined }),
      { analise_comercial: ['concluida', diretoria ? (t1 + fim) / 2 : fim], diretoria: ['concluida', fim] },
    )
    const proposta = registrarProposta(reserva, {
      situacao: 'aprovada',
      decididaEm: venda.data,
      versoes,
      etapas,
      historico: [
        evp('criacao', t1, 'Proposta criada', corretor, `A partir da reserva ${reserva.codigo}`, 1),
        evp('envio', t1, 'Enviada para aprovação', corretor, resumo(versoes[0]), 1),
        evp('aprovacao', fim, 'Proposta aprovada', diretoria ? 'Ayran Bade' : 'Matheus Oening', `v1 · ${formatarMoedaInteira(venda.valor)} · venda ${venda.codigo} registrada; contrato será gerado automaticamente`, 1),
      ],
    })
    venda.propostaId = proposta.id
    venda.historico[0] = { ...venda.historico[0], autor: diretoria ? 'Ayran Bade' : 'Matheus Oening', detalhe: `Proposta ${proposta.codigo} aprovada · ${formatarMoedaInteira(venda.valor)}` }
  }

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
  const lote12 = destaque[0].imovel
  novoInteresse(lote12, 'Marina Ferreira Duarte', 49)
  for (const n of NOMES_INTERESSE.slice(1, 4)) novoInteresse(lote12, n, 10 + interesses.length * 3)
  for (const imovel of imoveis) {
    if (imovel === lote12 || imovel.situacao === 'bloqueado' || rand() > 0.35) continue
    const qtd = 1 + Math.floor(rand() * 6)
    for (let k = 0; k < qtd; k++) novoInteresse(imovel, escolher(NOMES_INTERESSE), 1 + Math.floor(rand() * 90))
  }

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
    const fim = r.historico[1]
    if (fim && fim.tipo !== 'conversao') {
      evento({ imovelId: r.imovelId, data: fim.data, tipo: 'Reserva', descricao: `${fim.titulo}; imóvel liberado`, autor: fim.autor, referencia: r.codigo, situacao: { rotulo: 'Disponível', variante: 'normal' } })
    }
  }
  for (const p of propostas) {
    const envio = p.historico.find((e) => e.tipo === 'envio')
    if (envio) evento({ imovelId: p.imovelId, data: envio.data, tipo: 'Proposta', descricao: 'Proposta enviada para aprovação', autor: envio.autor, referencia: p.codigo, situacao: { rotulo: 'Em análise', variante: 'escuro' } })
  }
  for (const v of vendas) {
    evento({ imovelId: v.imovelId, data: v.data, tipo: 'Venda', descricao: `Venda registrada para ${nomeCliente(v.clienteId)}`, autor: escolher(autores), referencia: v.codigo, situacao: { rotulo: 'Vendido', variante: 'laranja' } })
    if (v.cancelamento) {
      evento({ imovelId: v.imovelId, data: v.cancelamento.em, tipo: 'Cancelamento', descricao: `Venda cancelada: ${v.cancelamento.justificativa}`, autor: v.cancelamento.autor, referencia: v.codigo, situacao: { rotulo: 'Bloqueado', variante: 'escuro' } })
    }
  }
  evento({ imovelId: lote12.id, data: new Date(agoraMs - 2 * HORA).toISOString(), tipo: 'Sistema', descricao: 'Aviso de vencimento da reserva enviado ao responsável', autor: 'Sistema', situacao: { rotulo: 'Atenção', variante: 'atencao' } })

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

  return {
    versao: VERSAO_DB,
    imoveis,
    clientes,
    corretores,
    reservas,
    propostas,
    vendas,
    usuarios,
    loteamentos,
    quadras,
    interesses,
    historico,
    documentos,
  }
}
