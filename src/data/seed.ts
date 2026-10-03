import { LOTEAMENTOS, type LoteamentoInicial } from './catalogos'
import { dataCalendario } from '../lib/reservas'
import type {
  Cliente,
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

export const VERSAO_DB = 3

const HORA = 3_600_000
const DIA = 24 * HORA

const NOMES_CLIENTES = [
  'Marina Alves', 'Rafael Nunes', 'Construtora ML', 'Ana Paula S.', 'Tiago Ferraz',
  'Bruno Carvalho', 'Juliana Rocha', 'Felipe Moraes', 'Camila Duarte', 'Lucas Pereira',
  'Patrícia Gomes', 'Eduardo Lins', 'Vanessa Kuhn', 'Rodrigo Sartori', 'Aline Becker',
  'Gustavo Weber', 'Larissa Schmitt', 'Diego Hoffmann', 'Renata Prado', 'Marcos Vieira',
  'Tatiane Zanella', 'André Castilho', 'Sílvia Menegatti', 'Paulo Rinaldi', 'Beatriz Fontana',
]

const NOMES_CORRETORES = ['J. Biló', 'D. Krüger', 'M. Oening', 'A. Pacheco', 'G. Lima']

const RUAS: Record<string, string[]> = {
  'Lot. Universitário': ['Rua das Acácias', 'Rua dos Ipês', 'Rua Universitária'],
  'Jd. Europa': ['Rua Lisboa', 'Rua Madri', 'Rua Viena'],
  'Biopark Toledo': ['Av. Ministro Cirne Lima'],
  'Jd. Porto Alegre': ['Rua Guaíba', 'Rua Farroupilha'],
}

const CONDICOES = ['À vista', 'Entrada 20% + 36x', 'Financiamento bancário', 'Entrada 40% + 12x']

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

  const clientes: Cliente[] = NOMES_CLIENTES.map((nome, i) => {
    const juridica = nome.startsWith('Construtora')
    const usuarioEmail = nome
      .normalize('NFD')
      .replace(/[\u0300-\u036f.]/g, '')
      .toLowerCase()
      .split(/\s+/)
      .join('.')
    const criadoEm = new Date(agora.getTime() - (400 + Math.floor(rand2() * 400)) * DIA).toISOString()
    return {
      id: `cli-${i + 1}`,
      nome,
      tipoPessoa: juridica ? 'juridica' : 'fisica',
      cpfCnpj: juridica ? gerarCnpj(rand2) : gerarCpf(rand2),
      dataNascimento: juridica
        ? ''
        : `${1960 + Math.floor(rand2() * 40)}-${pad(1 + Math.floor(rand2() * 12))}-${pad(1 + Math.floor(rand2() * 28))}`,
      estadoCivil: juridica ? '' : escolher2(ESTADOS_CIVIS),
      profissao: juridica ? '' : escolher2(PROFISSOES),
      telefone: `(45) 9${8800 + Math.floor(rand2() * 1199)}-${pad4(Math.floor(rand2() * 10000))}`,
      email: `${usuarioEmail}@email.com`,
      ativo: !CLIENTES_INATIVOS.includes(nome),
      endereco: {
        cep: `859${pad(Math.floor(rand2() * 100))}-${String(Math.floor(rand2() * 1000)).padStart(3, '0')}`,
        logradouro: escolher2(RUAS_CLIENTES),
        numero: String(100 + Math.floor(rand2() * 2900)),
        complemento: rand2() < 0.2 ? `Apto ${10 + Math.floor(rand2() * 90)}` : '',
        bairro: escolher2(BAIRROS_CLIENTES),
        cidade: 'Toledo',
        uf: 'PR',
        pais: 'Brasil',
      },
      criadoEm,
      atualizadoEm: criadoEm,
    }
  })
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

  // Vendas dos últimos 12 meses.
  const vendas: Venda[] = []
  for (let i = 0; i < 60; i++) {
    const imovel = retirar(livres[0])
    imovel.situacao = 'vendido'
    let data: number
    if (i < 3) {
      data = inicioMes + rand() * Math.max(agoraMs - inicioMes, HORA)
    } else {
      const mesesAtras = i < 6 ? 1 : 2 + Math.floor(rand() * 10)
      const ref = new Date(agora.getFullYear(), agora.getMonth() - mesesAtras, 1)
      data = ref.getTime() + rand() * 27 * DIA
    }
    vendas.push({
      id: `ven-${i + 1}`,
      codigo: `VD-${ano}-${pad4(92 - i)}`,
      status: 'ativa',
      imovelId: imovel.id,
      clienteId: escolher(clientes).id,
      valor: arredondar(imovel.valores.tabela! * (0.95 + rand() * 0.05)),
      data: new Date(Math.min(data, agoraMs)).toISOString(),
    })
  }

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
  for (const venda of vendas.slice(0, 6)) {
    const imovel = imoveis.find((i) => i.id === venda.imovelId)!
    const inicio = new Date(venda.data).getTime() - (5 + Math.floor(rand2() * 8)) * DIA
    const r = registrarReserva(imovel, venda.clienteId, escolher2(corretores).id, inicio, 15, fimDoDia(inicio + 15 * DIA), 'convertida')
    encerrar(r, { tipo: 'conversao', data: venda.data, titulo: 'Reserva convertida em venda', autor: 'Sistema', detalhe: `Venda ${venda.codigo}`, situacao: 'convertida' })
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
    const fim = r.historico[1]
    if (fim && fim.tipo !== 'conversao') {
      evento({ imovelId: r.imovelId, data: fim.data, tipo: 'Reserva', descricao: `${fim.titulo}; imóvel liberado`, autor: fim.autor, referencia: r.codigo, situacao: { rotulo: 'Disponível', variante: 'normal' } })
    }
  }
  for (const p of propostas) {
    evento({ imovelId: p.imovelId, data: p.criadaEm, tipo: 'Proposta', descricao: 'Proposta enviada para aprovação', autor: nomeCorretor(p.corretorId), referencia: p.codigo, situacao: { rotulo: 'Em análise', variante: 'escuro' } })
  }
  for (const v of vendas) {
    evento({ imovelId: v.imovelId, data: v.data, tipo: 'Venda', descricao: `Venda registrada para ${nomeCliente(v.clienteId)}`, autor: escolher(autores), referencia: v.codigo, situacao: { rotulo: 'Vendido', variante: 'laranja' } })
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
