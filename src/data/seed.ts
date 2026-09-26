import { LOTEAMENTOS, type Loteamento } from './catalogos'
import type { Db, Imovel, Pessoa, Proposta, Reserva, Venda } from './types'

export const VERSAO_DB = 1

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

const pad = (n: number) => String(n).padStart(2, '0')
const arredondar = (v: number, passo = 500) => Math.round(v / passo) * passo

export function criarSeed(agora: Date): Db {
  const rand = mulberry32(20260824)
  const escolher = <T,>(lista: T[]) => lista[Math.floor(rand() * lista.length)]
  const agoraMs = agora.getTime()
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).getTime()

  const clientes: Pessoa[] = NOMES_CLIENTES.map((nome, i) => ({ id: `cli-${i + 1}`, nome }))
  const corretores: Pessoa[] = NOMES_CORRETORES.map((nome, i) => ({ id: `cor-${i + 1}`, nome }))
  const cliente = (nome: string) => clientes.find((c) => c.nome === nome)!.id
  const corretor = (nome: string) => corretores.find((c) => c.nome === nome)!.id

  const planos: { lot: Loteamento; quadras: number; lotes: number }[] = [
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
  const novaReserva = (imovel: Imovel, cli: string, cor: string, expiraEmMs: number) => {
    retirar(imovel)
    imovel.situacao = 'reservado'
    reservas.push({
      id: `res-${reservas.length + 1}`,
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
      imovelId: imovel.id,
      clienteId: escolher(clientes).id,
      valor: arredondar(imovel.valores.tabela! * (0.95 + rand() * 0.05)),
      data: new Date(Math.min(data, agoraMs)).toISOString(),
    })
  }

  for (let i = 0; i < 8; i++) retirar(livres[0]).situacao = 'indisponivel'

  // Alguns cadastros recentes para o indicador "este mês".
  for (let i = 0; i < 6; i++) {
    const em = new Date(inicioMes + rand() * Math.max(agoraMs - inicioMes, HORA)).toISOString()
    livres[i].criadoEm = em
    livres[i].atualizadoEm = em
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
  }
}
