import { FileText, ImageOff } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { MapaLote } from '../../components/MapaLote'
import { Badge } from '../../components/ui'
import { useDb } from '../../data/db'
import { visivelNoCatalogo } from '../../data/selectors'
import { formatarDecimal, formatarMoedaInteira } from '../../lib/format'
import { InteresseDialogo } from './InteresseDialogo'

export function DetalheTerrenoPage() {
  const { id } = useParams()
  const db = useDb()
  const imovel = db.imoveis.find((i) => i.id === id)
  const [fotoAtiva, setFotoAtiva] = useState(0)
  const [interesse, setInteresse] = useState<{ mensagem: string } | null>(null)

  if (!imovel || !visivelNoCatalogo(imovel)) {
    return (
      <main className="site__conteudo">
        <section className="card vazio">
          <h1>Terreno indisponível</h1>
          <p>Este anúncio não está mais no catálogo. Veja outros terrenos disponíveis.</p>
          <Link to="/terrenos" className="btn btn--primario">Ver terrenos</Link>
        </section>
      </main>
    )
  }

  const { endereco: e, dimensoes: d, valores: v } = imovel
  const loteamento = db.loteamentos.find((l) => l.nome === imovel.loteamento)
  const reservado = imovel.situacao === 'reservado'
  const precoM2 = v.tabela && d.areaTotal ? Math.round(v.tabela / d.areaTotal) : null
  const documentos = db.documentos.filter((doc) => doc.imovelId === imovel.id && doc.visivelCatalogo && !doc.substituido)
  const fotos = imovel.fotos
  const principal = fotos[fotoAtiva] ?? fotos[0]
  const miniaturas = fotos.map((f, idx) => ({ f, idx })).filter((x) => x.idx !== fotoAtiva).slice(0, 3)
  const titulo = `Terreno ${d.areaTotal?.toLocaleString('pt-BR') ?? ''} m² — ${imovel.loteamento}${e.quadra ? `, Qd. ${e.quadra}` : ''} / Lote ${e.lote}`

  return (
    <main className="site__conteudo detalhe">
      <div className="detalhe__principal">
        <nav className="migalhas" aria-label="Você está em">
          <Link to="/terrenos">Início</Link>
          <span aria-hidden>›</span>
          <Link to="/terrenos">Terrenos</Link>
          <span aria-hidden>›</span>
          <Link to={`/terrenos?emp=${encodeURIComponent(imovel.loteamento)}`}>{imovel.loteamento}</Link>
          <span aria-hidden>›</span>
          <span>{e.quadra ? `Qd. ${e.quadra} / ` : ''}Lote {e.lote}</span>
        </nav>
        <h1 className="detalhe__titulo">{titulo}</h1>

        <div className="galeria">
          <div className="galeria__principal">
            {principal ? <img src={principal} alt={`Foto de ${titulo}`} /> : <span className="galeria__vazia"><ImageOff size={22} /> Fotos em breve</span>}
          </div>
          <div className="galeria__miniaturas">
            {miniaturas.map(({ f, idx }) => (
              <button key={idx} type="button" onClick={() => setFotoAtiva(idx)} aria-label={`Ver foto ${idx + 1}`}>
                <img src={f} alt="" />
              </button>
            ))}
            {Array.from({ length: Math.max(0, 3 - miniaturas.length) }, (_, k) => (
              <span key={k} className="galeria__slot" aria-hidden />
            ))}
          </div>
        </div>

        <section className="card secao">
          <div className="secao__cabecalho">
            <h2 className="card__titulo">Ficha técnica</h2>
            <p className="card__subtitulo">Dados conforme matrícula registrada</p>
          </div>
          <dl className="ficha">
            <div><dt>Matrícula</dt><dd>{imovel.matricula ? Number(imovel.matricula).toLocaleString('pt-BR') : 'Em registro'}</dd></div>
            <div><dt>Loteamento</dt><dd>{imovel.loteamento}</dd></div>
            <div><dt>Quadra / Lote</dt><dd>{e.quadra ? `${e.quadra} / ` : ''}{e.lote}</dd></div>
            <div><dt>Área</dt><dd>{d.areaTotal ? `${formatarDecimal(d.areaTotal)} m²` : '—'}</dd></div>
            <div><dt>Tipo</dt><dd>{imovel.tipo}</dd></div>
            <div><dt>Frente</dt><dd>{d.frente ? `${formatarDecimal(d.frente)} m` : '—'}</dd></div>
            <div><dt>Topografia</dt><dd>{d.topografia}</dd></div>
            <div><dt>Bairro</dt><dd>{e.bairro} · {e.cidade}/{e.uf}</dd></div>
          </dl>
        </section>

        <section className="card secao">
          <div className="secao__cabecalho">
            <h2 className="card__titulo">Localização</h2>
            <p className="card__subtitulo">Posição conforme georreferenciamento do lote</p>
          </div>
          <MapaLote
            lat={imovel.geo.lat}
            lng={imovel.geo.lng}
            centroPadrao={loteamento?.centro ?? { lat: -24.7246, lng: -53.7412 }}
            rotulo={`Lote ${e.lote}${e.quadra ? ` · Qd. ${e.quadra}` : ''}`}
            marcando={false}
            onMarcar={() => undefined}
          />
        </section>

        {documentos.length > 0 && (
          <section className="card secao">
            <div className="secao__cabecalho">
              <h2 className="card__titulo">Documentos</h2>
              <p className="card__subtitulo">Arquivos liberados pela Urbizzi para consulta</p>
            </div>
            <ul className="detalhe__docs">
              {documentos.map((doc) => (
                <li key={doc.id}>
                  <FileText size={15} aria-hidden />
                  {doc.conteudo ? <a href={doc.conteudo} download={doc.arquivo} className="link">{doc.tipo}</a> : <span>{doc.tipo}</span>}
                  <small className="texto-fraco">{doc.arquivo}</small>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <aside className="detalhe__lateral">
        <div className="card secao preco-card">
          <Badge variante={reservado ? 'atencao' : 'normal'}>{reservado ? 'Reservado' : 'Disponível'}</Badge>
          <strong className="preco-card__valor">{v.tabela ? formatarMoedaInteira(v.tabela) : 'Sob consulta'}</strong>
          <span className="preco-card__detalhe">
            {precoM2 ? `${formatarMoedaInteira(precoM2)} / m²` : ''}
            {imovel.publicacao.reservasOnline && !reservado ? ` · Reserva online por ${v.prazoReservaHoras >= 168 ? '7 dias' : `${v.prazoReservaHoras}h`}` : ''}
          </span>
          {reservado && <p className="nota-regra">Este lote está reservado. Deixe seu interesse para ser avisado se ele voltar à venda.</p>}
          <button type="button" className="btn btn--primario btn--bloco" onClick={() => setInteresse({ mensagem: '' })}>
            Tenho interesse
          </button>
          <button
            type="button"
            className="btn btn--secundario btn--bloco"
            onClick={() => setInteresse({ mensagem: 'Gostaria de falar com um corretor sobre este lote.' })}
          >
            Falar com um corretor
          </button>
          <span className="texto-fraco preco-card__codigo">Código do anúncio: {imovel.codigo}</span>
        </div>
      </aside>

      {interesse && <InteresseDialogo imovel={imovel} mensagemInicial={interesse.mensagem} onFechar={() => setInteresse(null)} />}
    </main>
  )
}
