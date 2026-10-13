import { ImageOff, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { Badge } from '../../components/ui'
import { useDb } from '../../data/db'
import type { Imovel } from '../../data/types'
import { formatarMoedaInteira, normalizar } from '../../lib/format'
import { InteresseDialogo } from './InteresseDialogo'

const AREAS = [
  { valor: '0-400', rotulo: 'Até 400 m²' },
  { valor: '400-700', rotulo: '400 a 700 m²' },
  { valor: '700-', rotulo: 'Acima de 700 m²' },
]
const PRECOS = [150000, 200000, 300000, 500000]
const ORDENS = [
  { valor: 'menor', rotulo: 'menor preço' },
  { valor: 'maior', rotulo: 'maior preço' },
  { valor: 'area', rotulo: 'maior área' },
  { valor: 'recentes', rotulo: 'mais recentes' },
] as const
const POR_PAGINA = 10

const nomeLote = (i: Imovel) =>
  i.endereco.quadra ? `Lote ${i.endereco.lote} — Qd. ${i.endereco.quadra}` : `Lote ${i.endereco.lote}`

export function CatalogoPage() {
  const db = useDb()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const filtros = {
    q: params.get('q') ?? '',
    emp: params.get('emp') ?? '',
    area: params.get('area') ?? '',
    max: params.get('max') ?? '',
  }
  const ordem = (params.get('ordem') ?? 'menor') as (typeof ORDENS)[number]['valor']
  const [rascunho, setRascunho] = useState(filtros)
  const [limite, setLimite] = useState(POR_PAGINA)
  const [destacado, setDestacado] = useState<string | null>(null)
  const [interesse, setInteresse] = useState<Imovel | null>(null)
  const cardsRef = useRef<Record<string, HTMLLIElement | null>>({})

  // Mantém os campos em sincronia quando a URL muda (voltar/avançar do navegador).
  const chaveFiltros = params.toString()
  useEffect(() => {
    setRascunho({ q: params.get('q') ?? '', emp: params.get('emp') ?? '', area: params.get('area') ?? '', max: params.get('max') ?? '' })
    setLimite(POR_PAGINA)
  }, [chaveFiltros]) // eslint-disable-line react-hooks/exhaustive-deps

  const disponiveis = useMemo(
    () => db.imoveis.filter((i) => i.status === 'publicado' && i.publicacao.catalogo && i.situacao === 'disponivel'),
    [db.imoveis],
  )
  const porLoteamento = useMemo(() => {
    const m = new Map<string, number>()
    for (const i of disponiveis) m.set(i.loteamento, (m.get(i.loteamento) ?? 0) + 1)
    return m
  }, [disponiveis])

  const resultados = useMemo(() => {
    const termo = normalizar(filtros.q.trim())
    const [amin, amax] = filtros.area ? filtros.area.split('-').map((x) => (x ? Number(x) : null)) : [null, null]
    const lista = disponiveis
      .filter((i) => !filtros.emp || i.loteamento === filtros.emp)
      .filter((i) => !filtros.max || (i.valores.tabela ?? Infinity) <= Number(filtros.max))
      .filter((i) => {
        const a = i.dimensoes.areaTotal ?? 0
        return (amin === null || a >= amin) && (amax === null || a < amax)
      })
      .filter(
        (i) =>
          !termo ||
          normalizar(`${i.endereco.cidade} ${i.endereco.bairro} ${i.loteamento} ${i.codigo} ${nomeLote(i)}`).includes(termo),
      )
    const valor = (i: Imovel) => i.valores.tabela ?? 0
    return lista.sort((a, b) => {
      if (ordem === 'maior') return valor(b) - valor(a)
      if (ordem === 'area') return (b.dimensoes.areaTotal ?? 0) - (a.dimensoes.areaTotal ?? 0)
      if (ordem === 'recentes') return b.criadoEm.localeCompare(a.criadoEm)
      return valor(a) - valor(b)
    })
  }, [disponiveis, filtros.q, filtros.emp, filtros.area, filtros.max, ordem])

  const cidades = [...new Set(resultados.map((i) => `${i.endereco.cidade} — ${i.endereco.uf}`))]
  const visiveis = resultados.slice(0, limite)

  const buscar = (e: FormEvent) => {
    e.preventDefault()
    const novo = new URLSearchParams()
    for (const [k, v] of Object.entries(rascunho)) if (v) novo.set(k, v)
    if (ordem !== 'menor') novo.set('ordem', ordem)
    setParams(novo)
  }

  const trocarOrdem = () => {
    const idx = ORDENS.findIndex((o) => o.valor === ordem)
    const novo = new URLSearchParams(params)
    novo.set('ordem', ORDENS[(idx + 1) % ORDENS.length].valor)
    setParams(novo, { replace: true })
  }

  const verNoMapa = (id: string) => setDestacado(id)
  const focarCard = (id: string) => {
    setDestacado(id)
    const idx = resultados.findIndex((i) => i.id === id)
    if (idx >= limite) setLimite(Math.ceil((idx + 1) / POR_PAGINA) * POR_PAGINA)
    requestAnimationFrame(() => cardsRef.current[id]?.scrollIntoView?.({ behavior: 'smooth', block: 'center' }))
  }

  return (
    <>
      <form className="catalogo__filtros" onSubmit={buscar} role="search">
        <div className="busca catalogo__busca">
          <Search size={15} className="busca__icone" aria-hidden />
          <input
            className="busca__input"
            placeholder="Buscar por cidade, bairro ou código"
            aria-label="Buscar por cidade, bairro ou código"
            value={rascunho.q}
            onChange={(e) => setRascunho({ ...rascunho, q: e.target.value })}
          />
        </div>
        <select className="input select" aria-label="Empreendimento" value={rascunho.emp} onChange={(e) => setRascunho({ ...rascunho, emp: e.target.value })}>
          <option value="">Empreendimento</option>
          {db.loteamentos.map((l) => <option key={l.id}>{l.nome}</option>)}
        </select>
        <select className="input select" aria-label="Área" value={rascunho.area} onChange={(e) => setRascunho({ ...rascunho, area: e.target.value })}>
          <option value="">Área</option>
          {AREAS.map((a) => <option key={a.valor} value={a.valor}>{a.rotulo}</option>)}
        </select>
        <select className="input select" aria-label="Preço máximo" value={rascunho.max} onChange={(e) => setRascunho({ ...rascunho, max: e.target.value })}>
          <option value="">Qualquer preço</option>
          {PRECOS.map((p) => <option key={p} value={p}>Até {formatarMoedaInteira(p).replace(/\.000$/, ' mil').replace(/,00$/, '')}</option>)}
        </select>
        <button type="submit" className="btn btn--primario">Buscar</button>
      </form>

      <div className="catalogo">
        <section className="catalogo__lista" aria-labelledby="catalogo-titulo">
          <div className="catalogo__cabecalho">
            <div>
              <h1 id="catalogo-titulo" className="catalogo__titulo">
                {resultados.length} {resultados.length === 1 ? 'terreno' : 'terrenos'}
                {cidades.length === 1 ? ` em ${cidades[0]}` : ' disponíveis'}
              </h1>
              <p className="card__subtitulo">Valores sujeitos a confirmação · atualizado hoje</p>
            </div>
            <button type="button" className="link" onClick={trocarOrdem}>
              Ordenar: {ORDENS.find((o) => o.valor === ordem)?.rotulo}
            </button>
          </div>

          {resultados.length === 0 ? (
            <div className="card vazio">
              <h2>Nenhum terreno com esses filtros</h2>
              <button type="button" className="btn btn--secundario" onClick={() => setParams({})}>Limpar filtros</button>
            </div>
          ) : (
            <ul className="catalogo__cards">
              {visiveis.map((i) => {
                const ultima = porLoteamento.get(i.loteamento) === 1
                return (
                  <li
                    key={i.id}
                    ref={(el) => {
                      cardsRef.current[i.id] = el
                    }}
                    className={`card terreno ${destacado === i.id ? 'terreno--destacado' : ''}`}
                    onMouseEnter={() => setDestacado(i.id)}
                  >
                    <Link to={`/terrenos/${i.id}`} className="terreno__foto" tabIndex={-1} aria-hidden>
                      {i.fotos[0] ? <img src={i.fotos[0]} alt="" /> : <ImageOff size={18} />}
                    </Link>
                    <div className="terreno__info">
                      <div className="terreno__linha">
                        <Link to={`/terrenos/${i.id}`} className="terreno__nome">{nomeLote(i)}</Link>
                        <Badge variante={ultima ? 'atencao' : 'normal'}>{ultima ? 'Última unidade' : 'Disponível'}</Badge>
                      </div>
                      <span className="terreno__detalhe">
                        {i.loteamento} · {i.dimensoes.areaTotal?.toLocaleString('pt-BR')} m²
                      </span>
                      <strong className="terreno__preco">{i.valores.tabela ? formatarMoedaInteira(i.valores.tabela) : 'Sob consulta'}</strong>
                    </div>
                    <div className="terreno__acoes">
                      <button type="button" className="btn btn--primario" onClick={() => setInteresse(i)}>Tenho interesse</button>
                      <button type="button" className="link link--cinza" onClick={() => verNoMapa(i.id)}>Ver no mapa</button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          {resultados.length > limite && (
            <button type="button" className="btn btn--secundario btn--bloco" onClick={() => setLimite((l) => l + POR_PAGINA)}>
              Mostrar mais {Math.min(POR_PAGINA, resultados.length - limite)} terrenos
            </button>
          )}
        </section>

        <MapaCatalogo imoveis={resultados} destacado={destacado} onEscolher={focarCard} onAbrir={(id) => navigate(`/terrenos/${id}`)} />
      </div>

      {interesse && <InteresseDialogo key={interesse.id} imovel={interesse} onFechar={() => setInteresse(null)} />}
    </>
  )
}

interface MapaProps {
  imoveis: Imovel[]
  destacado: string | null
  onEscolher: (id: string) => void
  onAbrir: (id: string) => void
}

/** Mapa esquemático: posiciona os pinos pelas coordenadas reais dos lotes. */
function MapaCatalogo({ imoveis, destacado, onEscolher, onAbrir }: Readonly<MapaProps>) {
  const pontos = imoveis.filter((i) => i.geo.lat !== null && i.geo.lng !== null)
  const lats = pontos.map((i) => i.geo.lat!)
  const lngs = pontos.map((i) => i.geo.lng!)
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)]
  const faixaLat = Math.max(maxLat - minLat, 0.002)
  const faixaLng = Math.max(maxLng - minLng, 0.002)
  const x = (lng: number) => 8 + ((lng - minLng) / faixaLng) * 84
  const y = (lat: number) => 8 + ((maxLat - lat) / faixaLat) * 84
  const ativo = pontos.find((i) => i.id === destacado)

  return (
    <aside className="catalogo__mapa" aria-label="Mapa dos terrenos">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        <rect width="100" height="100" fill="#f8f2ee" />
        <line x1="0" y1="20" x2="100" y2="34" stroke="#cfcfcb" strokeWidth="1.2" />
        <line x1="62" y1="0" x2="62" y2="100" stroke="#cfcfcb" strokeWidth="1.2" />
        <line x1="0" y1="70" x2="100" y2="66" stroke="#dededa" strokeWidth="0.8" />
      </svg>
      {pontos.map((i) => (
        <button
          key={i.id}
          type="button"
          className={`pino ${i.id === destacado ? 'pino--ativo' : ''}`}
          style={{ left: `${x(i.geo.lng!)}%`, top: `${y(i.geo.lat!)}%` }}
          aria-label={`${nomeLote(i)}, ${i.loteamento}`}
          onClick={() => onEscolher(i.id)}
          onDoubleClick={() => onAbrir(i.id)}
        />
      ))}
      {ativo && (
        <div className="catalogo__balao" style={{ left: `${x(ativo.geo.lng!)}%`, top: `${y(ativo.geo.lat!)}%` }}>
          <strong>{nomeLote(ativo)}</strong>
          <span>{ativo.valores.tabela ? formatarMoedaInteira(ativo.valores.tabela) : ''}</span>
          <Link to={`/terrenos/${ativo.id}`} className="link">Ver detalhes</Link>
        </div>
      )}
      {pontos.length === 0 && <p className="catalogo__mapa-vazio">Nenhum terreno para mostrar no mapa.</p>}
    </aside>
  )
}
