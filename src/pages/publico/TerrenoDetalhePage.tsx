import { ImageOff } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { MapaLote } from '../../components/MapaLote'
import { Badge } from '../../components/ui'
import { useDb } from '../../data/db'
import { visivelNoCatalogo } from '../../data/selectors'
import type { Imovel } from '../../data/types'
import { formatarDecimal, formatarMoedaInteira } from '../../lib/format'
import { InteresseDialogo } from './InteresseDialogo'

const CENTRO_PADRAO = { lat: -24.7239, lng: -53.7412 }

// O mapa público só exibe o ponto; marcar fica restrito ao cadastro interno.
const semMarcacao = () => undefined

function quadraLote(imovel: Imovel) {
  const { quadra, lote } = imovel.endereco
  if (!lote) return imovel.titulo
  return quadra ? `Qd. ${quadra} / Lote ${lote}` : `Lote ${lote}`
}

function Dado({ rotulo, valor }: Readonly<{ rotulo: string; valor: string | null | undefined }>) {
  return (
    <div>
      <dt>{rotulo}</dt>
      <dd>{valor || '—'}</dd>
    </div>
  )
}

/** Detalhe público do terreno (/terrenos/:id), com o formulário "Tenho interesse". */
export function TerrenoDetalhePage() {
  const { id } = useParams()
  const db = useDb()
  const [interesse, setInteresse] = useState<{ mensagem: string } | null>(null)
  const imovel = db.imoveis.find((i) => i.id === id)

  if (imovel?.status !== 'publicado') {
    return (
      <main className="site__conteudo">
        <section className="card vazio">
          <h1>Terreno não encontrado</h1>
          <p>O anúncio pode ter sido removido do catálogo.</p>
          <Link to="/terrenos" className="btn btn--primario">Ver terrenos disponíveis</Link>
        </section>
      </main>
    )
  }

  const disponivel = visivelNoCatalogo(imovel)
  const loteamento = db.loteamentos.find((l) => l.nome === imovel.loteamento)
  const area = imovel.dimensoes.areaTotal
  const preco = imovel.valores.tabela
  const precoM2 = preco && area ? Math.round(preco / area) : null
  const fotos = imovel.fotos.slice(0, 4)
  const textoArea = area ? `${formatarDecimal(area)} m²` : ''
  const local = [imovel.loteamento, quadraLote(imovel)].filter(Boolean).join(', ')
  const titulo = ['Terreno', textoArea].filter(Boolean).join(' ') + ' — ' + local

  return (
    <main className="site__conteudo terreno-detalhe">
      <nav className="migalhas" aria-label="Você está em">
        <Link to="/terrenos">Início</Link>
        <span aria-hidden>›</span>
        <Link to="/terrenos">Terrenos</Link>
        {imovel.loteamento && (
          <>
            <span aria-hidden>›</span>
            <Link to={`/terrenos?emp=${encodeURIComponent(imovel.loteamento)}`}>{imovel.loteamento}</Link>
          </>
        )}
        <span aria-hidden>›</span>
        <span>{quadraLote(imovel)}</span>
      </nav>
      <h1 className="terreno-detalhe__titulo">{titulo}</h1>

      <div className="terreno-detalhe__grade">
        <div className="pilha">
          <section className="terreno-detalhe__galeria" aria-label="Fotos do terreno">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={`terreno-detalhe__foto ${i === 0 ? 'terreno-detalhe__foto--capa' : ''}`}>
                {fotos[i] ? <img src={fotos[i]} alt={i === 0 ? titulo : ''} /> : <ImageOff size={i === 0 ? 28 : 16} aria-hidden />}
              </div>
            ))}
          </section>

          <section className="card secao">
            <div className="secao__cabecalho">
              <h2 className="card__titulo">Ficha técnica</h2>
              <p className="card__subtitulo">Dados conferidos na matrícula do imóvel.</p>
            </div>
            <dl className="terreno-detalhe__ficha">
              <Dado rotulo="Matrícula" valor={imovel.matricula || 'Em registro'} />
              <Dado rotulo="Loteamento" valor={imovel.loteamento} />
              <Dado rotulo="Quadra / Lote" valor={quadraLote(imovel)} />
              <Dado rotulo="Área" valor={area ? `${formatarDecimal(area)} m²` : null} />
              <Dado rotulo="Tipo" valor={imovel.tipo} />
              <Dado rotulo="Frente" valor={imovel.dimensoes.frente ? `${formatarDecimal(imovel.dimensoes.frente)} m` : null} />
              <Dado rotulo="Topografia" valor={imovel.dimensoes.topografia} />
              <Dado rotulo="Bairro" valor={[imovel.endereco.bairro, `${imovel.endereco.cidade}/${imovel.endereco.uf}`].filter(Boolean).join(' · ')} />
            </dl>
          </section>

          <section className="card secao">
            <div className="secao__cabecalho">
              <h2 className="card__titulo">Localização</h2>
              <p className="card__subtitulo">Posição do lote dentro do loteamento.</p>
            </div>
            <MapaLote
              lat={imovel.geo.lat}
              lng={imovel.geo.lng}
              centroPadrao={loteamento?.centro ?? CENTRO_PADRAO}
              rotulo={quadraLote(imovel)}
              marcando={false}
              onMarcar={semMarcacao}
            />
          </section>
        </div>

        <aside className="card terreno-detalhe__oferta" aria-label="Valores e contato">
          {disponivel ? (
            <>
              <Badge variante={imovel.situacao === 'reservado' ? 'atencao' : 'normal'}>
                {imovel.situacao === 'reservado' ? 'Reservado' : 'Disponível'}
              </Badge>
              <strong className="terreno-detalhe__preco">{preco ? formatarMoedaInteira(preco) : 'Sob consulta'}</strong>
              {precoM2 && <span className="texto-fraco">{formatarMoedaInteira(precoM2)} / m² · parcelamento direto</span>}
              <button type="button" className="btn btn--primario" onClick={() => setInteresse({ mensagem: '' })}>
                Tenho interesse
              </button>
              <button
                type="button"
                className="btn btn--secundario"
                onClick={() => setInteresse({ mensagem: 'Gostaria de falar com um corretor sobre este terreno.' })}
              >
                Falar com um corretor
              </button>
            </>
          ) : (
            <>
              <Badge variante="escuro">Indisponível</Badge>
              <output className="terreno-detalhe__aviso">
                Este terreno não está mais disponível para venda. Veja outras opções no catálogo.
              </output>
              <Link to="/terrenos" className="btn btn--primario">Ver terrenos disponíveis</Link>
            </>
          )}
          <span className="texto-fraco">Código do anúncio: {imovel.codigo}</span>
        </aside>
      </div>

      {interesse && (
        <InteresseDialogo imovel={imovel} mensagemInicial={interesse.mensagem} onFechar={() => setInteresse(null)} />
      )}
    </main>
  )
}
