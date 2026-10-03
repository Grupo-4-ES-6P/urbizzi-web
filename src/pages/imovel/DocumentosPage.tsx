import { Download, Plus } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'

import { Badge, Campo, Spinner } from '../../components/ui'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { TIPOS_DOCUMENTO } from '../../data/catalogos'
import { useDb } from '../../data/db'
import type { Documento, VarianteBadge } from '../../data/types'
import { enviarDocumento } from '../../services/api'
import { CabecalhoLote } from './CabecalhoLote'
import { useImovelDaRota } from './lote'

const EXTENSOES = ['pdf', 'jpg', 'jpeg', 'png', 'dwg', 'zip']
const TAMANHO_MAX = 20 * 1024 * 1024
const MES = 30 * 24 * 3_600_000

function formatarTamanho(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

function situacaoDocumento(d: Documento, agora: number): { rotulo: string; variante: VarianteBadge } {
  if (d.substituido) return { rotulo: 'Substituído', variante: 'escuro' }
  if (d.aguardandoAssinatura) return { rotulo: 'Aguardando assinatura', variante: 'atencao' }
  if (d.validade) {
    const restante = new Date(`${d.validade}T23:59:59`).getTime() - agora
    if (restante < 0) return { rotulo: 'Vencido', variante: 'critico' }
    const meses = Math.floor(restante / MES)
    if (meses < 12) return { rotulo: meses <= 0 ? 'Vence este mês' : `Vence em ${meses} ${meses === 1 ? 'mês' : 'meses'}`, variante: 'atencao' }
  }
  if (d.visivelCatalogo) return { rotulo: 'No catálogo', variante: 'escuro' }
  return { rotulo: 'Vigente', variante: 'normal' }
}

function baixar(d: Documento) {
  if (!d.conteudo) return
  const a = document.createElement('a')
  a.href = d.conteudo
  a.download = d.arquivo
  a.click()
}

export function DocumentosPage() {
  const db = useDb()
  const notificar = useToast()
  const { usuario } = useAuth()
  const { imovel, naoEncontrado } = useImovelDaRota()
  const inputRef = useRef<HTMLInputElement>(null)
  const [tipo, setTipo] = useState(TIPOS_DOCUMENTO[0])
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [validade, setValidade] = useState('')
  const [visivel, setVisivel] = useState(false)
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  const documentos = useMemo(
    () =>
      db.documentos
        .filter((d) => d.imovelId === imovel?.id)
        .sort((a, b) => Number(a.substituido) - Number(b.substituido) || b.data.localeCompare(a.data)),
    [db.documentos, imovel?.id],
  )

  if (!imovel) return naoEncontrado
  const agora = Date.now()
  const totalBytes = documentos.reduce((s, d) => s + d.tamanho, 0)
  const baixaveis = documentos.filter((d) => !d.substituido && d.conteudo)
  const versaoAtual = documentos.filter((d) => d.tipo === tipo).reduce((m, d) => Math.max(m, d.versao), 0)

  const escolher = (f: File) => {
    const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
    if (!EXTENSOES.includes(ext)) return setErro('Formato não aceito. Use PDF, JPG, PNG, DWG ou ZIP.')
    if (f.size > TAMANHO_MAX) return setErro('O arquivo passa de 20 MB.')
    setErro('')
    setArquivo(f)
  }

  const enviar = async () => {
    if (!arquivo) {
      setErro('Escolha um arquivo.')
      inputRef.current?.click()
      return
    }
    setEnviando(true)
    try {
      const versao = await enviarDocumento(imovel.id, { tipo, arquivo, validade, visivelCatalogo: visivel }, usuario?.nome ?? 'Administrador')
      notificar(versao > 1 ? `${tipo} enviado como versão ${versao}. A anterior continua no histórico.` : `${tipo} enviado.`)
      setArquivo(null)
      setValidade('')
    } catch (e) {
      notificar(e instanceof Error ? e.message : 'Não foi possível enviar.', 'erro')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <CabecalhoLote
        imovel={imovel}
        secao="Documentos"
        subtitulo="Anexos do imóvel com versão, validade e autor do envio · RF07"
        acoes={
          <>
            <button
              type="button"
              className="btn btn--secundario"
              disabled={baixaveis.length === 0}
              title={baixaveis.length === 0 ? 'Nenhum arquivo vigente disponível para download nesta demonstração' : undefined}
              onClick={() => baixaveis.forEach((d, i) => setTimeout(() => baixar(d), i * 300))}
            >
              <Download size={15} /> Baixar tudo
            </button>
            <button type="button" className="btn btn--primario" onClick={enviar} disabled={enviando}>
              {enviando ? <Spinner /> : <Plus size={16} />} Enviar arquivo
            </button>
          </>
        }
      />
      <main className="conteudo pilha">
        <section className="card secao">
          <div className="secao__cabecalho">
            <h2 className="card__titulo">Enviar arquivo</h2>
            <p className="card__subtitulo">Substituir um documento existente cria uma nova versão em vez de sobrescrever.</p>
          </div>
          <div className="grade">
            <Campo rotulo="Tipo de documento" className="c-3" dica={versaoAtual ? `Será a versão ${versaoAtual + 1}` : undefined}>
              {(p) => (
                <select {...p} className="input select" value={tipo} onChange={(e) => setTipo(e.target.value)}>
                  {TIPOS_DOCUMENTO.map((t) => <option key={t}>{t}</option>)}
                </select>
              )}
            </Campo>
            <Campo rotulo="Arquivo" erro={erro} className="c-4">
              {(p) => (
                <button {...p} type="button" className="input input--arquivo" onClick={() => inputRef.current?.click()}>
                  {arquivo ? `${arquivo.name} · ${formatarTamanho(arquivo.size)}` : 'Escolher arquivo…'}
                </button>
              )}
            </Campo>
            <input
              ref={inputRef}
              type="file"
              hidden
              accept={EXTENSOES.map((e) => `.${e}`).join(',')}
              aria-label="Selecionar documento"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) escolher(f)
                e.target.value = ''
              }}
            />
            <Campo rotulo="Validade" className="c-2">
              {(p) => <input {...p} type="date" className="input" value={validade} onChange={(e) => setValidade(e.target.value)} />}
            </Campo>
            <Campo rotulo="Visível no catálogo" className="c-3">
              {(p) => (
                <select {...p} className="input select" value={visivel ? 'sim' : 'nao'} onChange={(e) => setVisivel(e.target.value === 'sim')}>
                  <option value="nao">Não</option>
                  <option value="sim">Sim</option>
                </select>
              )}
            </Campo>
          </div>
          <p className="nota-regra">Formatos aceitos: PDF, JPG, PNG, DWG e ZIP, até 20 MB por arquivo. Documentos visíveis aparecem na página pública do imóvel.</p>
        </section>

        <section className="card">
          <div className="card__cabecalho">
            <div>
              <h2 className="card__titulo">Arquivos do imóvel</h2>
              <p className="card__subtitulo">
                {documentos.length} {documentos.length === 1 ? 'documento' : 'documentos'} · {formatarTamanho(totalBytes)} no total. Versões antigas continuam acessíveis.
              </p>
            </div>
          </div>
          {documentos.length === 0 ? (
            <p className="card__vazio">Nenhum documento enviado.</p>
          ) : (
            <div className="tabela-wrap">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Documento</th>
                    <th>Versão</th>
                    <th>Arquivo</th>
                    <th>Enviado por</th>
                    <th>Data</th>
                    <th>Situação</th>
                    <th><span className="sr-only">Baixar</span></th>
                  </tr>
                </thead>
                <tbody>
                  {documentos.map((d) => {
                    const s = situacaoDocumento(d, agora)
                    return (
                      <tr key={d.id} className={d.substituido ? 'linha--antiga' : undefined}>
                        <td className="tabela__destaque">{d.tipo}</td>
                        <td>{d.aguardandoAssinatura ? '—' : `v${d.versao}`}</td>
                        <td>{d.arquivo}</td>
                        <td>{d.enviadoPor}</td>
                        <td>{new Date(d.data).toLocaleDateString('pt-BR')}</td>
                        <td><Badge variante={s.variante}>{s.rotulo}</Badge></td>
                        <td>
                          <button
                            type="button"
                            className="btn btn--secundario btn--icone"
                            disabled={!d.conteudo}
                            title={d.conteudo ? 'Baixar' : 'Arquivo de exemplo, sem conteúdo para download'}
                            aria-label={`Baixar ${d.arquivo}`}
                            onClick={() => baixar(d)}
                          >
                            <Download size={14} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <p className="nota-regra">RF07 — substituir um arquivo cria nova versão; a anterior fica no histórico e nunca é apagada.</p>
      </main>
    </>
  )
}
