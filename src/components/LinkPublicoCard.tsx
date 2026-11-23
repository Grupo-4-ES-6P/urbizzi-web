import { Copy, Link2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { useToast } from '../contexts/ToastContext'
import { useDb } from '../data/db'
import { rotuloImovel } from '../data/selectors'
import type { Db } from '../data/types'
import { formatarData } from '../lib/format'
import { criarLink, enderecoDoLink, listarLinks, type Escopo, type LinkPublico } from '../services/linksPublicos'
import { Campo, Spinner } from './ui'

const ESCOPOS: ReadonlyArray<{ valor: Escopo; rotulo: string }> = [
  { valor: 'catalogo', rotulo: 'Catálogo inteiro' },
  { valor: 'loteamento', rotulo: 'Loteamento' },
  { valor: 'imovel', rotulo: 'Imóvel específico' },
]

const VALIDADES: ReadonlyArray<{ rotulo: string; dias: number | null }> = [
  { rotulo: 'Sem expiração', dias: null },
  { rotulo: '7 dias', dias: 7 },
  { rotulo: '30 dias', dias: 30 },
  { rotulo: '90 dias', dias: 90 },
]

function opcoesAlvo(db: Db, escopo: Escopo) {
  if (escopo === 'loteamento') return db.loteamentos.map((l) => ({ valor: l.id, rotulo: l.nome }))
  if (escopo === 'imovel') return db.imoveis.map((i) => ({ valor: i.id, rotulo: rotuloImovel(i) }))
  return [{ valor: '', rotulo: 'Todos os imóveis publicados' }]
}

function idsNoEscopo(db: Db, escopo: Escopo, alvo: string) {
  if (escopo === 'imovel') return new Set([alvo])
  if (escopo === 'loteamento') {
    const nome = db.loteamentos.find((l) => l.id === alvo)?.nome
    return new Set(db.imoveis.filter((i) => i.loteamento === nome).map((i) => i.id))
  }
  return new Set(db.imoveis.map((i) => i.id))
}

const doAlvo = (l: LinkPublico, escopo: Escopo, alvo: string) => l.escopo === escopo && (l.alvo ?? '') === alvo

export function LinkPublicoCard() {
  const db = useDb()
  const notificar = useToast()
  const [escopo, setEscopo] = useState<Escopo>('imovel')
  const [alvo, setAlvo] = useState(() => db.imoveis[0]?.id ?? '')
  const [validade, setValidade] = useState(VALIDADES[0].rotulo)
  const [links, setLinks] = useState<LinkPublico[]>([])
  const [gerando, setGerando] = useState(false)

  useEffect(() => {
    listarLinks()
      .then(setLinks)
      .catch(() => setLinks([]))
  }, [])

  const opcoes = useMemo(() => opcoesAlvo(db, escopo), [db, escopo])
  const atual = links.find((l) => doAlvo(l, escopo, alvo))
  const ids = idsNoEscopo(db, escopo, alvo)
  const interesses = db.interesses.filter((i) => ids.has(i.imovelId)).length
  const endereco = atual ? enderecoDoLink(atual.token) : ''
  const expirado = !!atual?.expiraEm && new Date(atual.expiraEm).getTime() <= Date.now()

  const trocarEscopo = (novo: Escopo) => {
    setEscopo(novo)
    setAlvo(opcoesAlvo(db, novo)[0]?.valor ?? '')
  }

  const gerar = async () => {
    setGerando(true)
    try {
      const dias = VALIDADES.find((v) => v.rotulo === validade)?.dias ?? null
      const novo = await criarLink(escopo, escopo === 'catalogo' ? null : alvo, dias)
      setLinks((lista) => [novo, ...lista])
      notificar('Link público gerado.')
    } catch (error_) {
      notificar(error_ instanceof Error ? error_.message : 'Não foi possível gerar o link.', 'erro')
    } finally {
      setGerando(false)
    }
  }

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(endereco)
      notificar('Link copiado.')
    } catch {
      notificar('Não foi possível copiar; selecione o endereço e copie manualmente.', 'erro')
    }
  }

  return (
    <section className="card secao" aria-label="Gerar link público">
      <div className="secao__cabecalho">
        <h2 className="card__titulo">Gerar link público</h2>
        <p className="card__subtitulo">Endereço de consulta do catálogo inteiro, de um loteamento ou de um imóvel.</p>
      </div>
      <div className="grade">
        <Campo rotulo="Escopo" className="c-3">
          {(p) => (
            <select {...p} className="input select" value={escopo} onChange={(e) => trocarEscopo(e.target.value as Escopo)}>
              {ESCOPOS.map((s) => (
                <option key={s.valor} value={s.valor}>
                  {s.rotulo}
                </option>
              ))}
            </select>
          )}
        </Campo>
        <Campo rotulo="Alvo" className="c-6">
          {(p) => (
            <select {...p} className="input select" value={alvo} disabled={escopo === 'catalogo'} onChange={(e) => setAlvo(e.target.value)}>
              {opcoes.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.rotulo}
                </option>
              ))}
            </select>
          )}
        </Campo>
        <Campo rotulo="Validade do link" className="c-3">
          {(p) => (
            <select {...p} className="input select" value={validade} onChange={(e) => setValidade(e.target.value)}>
              {VALIDADES.map((v) => (
                <option key={v.rotulo}>{v.rotulo}</option>
              ))}
            </select>
          )}
        </Campo>
        <Campo
          rotulo="Endereço gerado"
          className="c-6"
          dica={
            expirado
              ? 'Este link expirou: gere um novo.'
              : 'RF31 — se o imóvel sair de Disponível, o link passa a exibir aviso de indisponível em vez dos dados comerciais.'
          }
        >
          {(p) => (
            <div className="input-adorno">
              <input {...p} className="input" readOnly value={endereco} placeholder="Nenhum link gerado para este alvo" />
              <button type="button" className="input-adorno__botao" onClick={copiar} disabled={!endereco} aria-label="Copiar link">
                <Copy size={16} />
              </button>
            </div>
          )}
        </Campo>
        <Campo rotulo="Visitas" className="c-2">
          {(p) => <input {...p} className="input" readOnly value={atual?.visitas ?? 0} />}
        </Campo>
        <Campo rotulo="Interesses recebidos" className="c-2">
          {(p) => <input {...p} className="input" readOnly value={interesses} />}
        </Campo>
        <Campo rotulo="Criado em" className="c-2">
          {(p) => <input {...p} className="input" readOnly value={atual ? formatarData(atual.criadoEm) : '—'} />}
        </Campo>
      </div>
      <div className="secao__acoes">
        <button type="button" className="btn btn--primario" onClick={gerar} disabled={gerando || (escopo !== 'catalogo' && !alvo)}>
          {gerando ? <Spinner /> : <Link2 size={15} />} {atual ? 'Gerar novo link' : 'Gerar link'}
        </button>
      </div>
    </section>
  )
}
