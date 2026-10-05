import { Crosshair, MapPin } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { Dialogo } from '../components/Dialogo'
import { FotosImovel } from '../components/FotosImovel'
import { InputNumerico } from '../components/InputNumerico'
import { MapaLote } from '../components/MapaLote'
import { Campo, Spinner, Toggle } from '../components/ui'
import { useToast } from '../contexts/ToastContext'
import {
  buscarLoteamento,
  LOTEAMENTOS,
  PRAZOS_RESERVA,
  SITUACOES,
  TIPOS_IMOVEL,
  TOPOGRAFIAS,
  UFS,
} from '../data/catalogos'
import { lerDb, useDb } from '../data/db'
import { proximoCodigo } from '../data/selectors'
import type { Imovel, Situacao } from '../data/types'
import { mascaraCep } from '../lib/format'
import {
  formDeImovel,
  formVazio,
  imovelDeForm,
  lerCoordenada,
  podeSalvarRascunho,
  validarPublicacao,
  type ErrosForm,
  type FormImovel,
} from '../lib/imovelForm'
import { buscarCep, excluirImovel, salvarImovel } from '../services/api'

const TOLEDO = { lat: -24.7246, lng: -53.7412 }

export function ImovelFormPage() {
  const { id } = useParams()
  const db = useDb()
  const imovel = id ? db.imoveis.find((i) => i.id === id) : undefined

  if (id && !imovel) {
    return (
      <main className="conteudo">
        <section className="card vazio">
          <h2>Imóvel não encontrado</h2>
          <p>Ele pode ter sido excluído.</p>
          <Link to="/imoveis" className="btn btn--secundario">
            Voltar para imóveis
          </Link>
        </section>
      </main>
    )
  }
  // A key recria o formulário ao trocar de imóvel (ex.: rascunho recém-salvo).
  return <FormularioImovel key={id ?? 'novo'} imovel={imovel} />
}

const textoRevisao = (total: number) =>
  total === 1 ? 'Revise o campo destacado antes de publicar.' : `Revise os ${total} campos destacados antes de publicar.`

function rotuloDoLote(lote: string, quadra: string) {
  if (!lote) return 'Lote'
  const sufixo = quadra ? ` · Qd. ${quadra}` : ''
  return `Lote ${lote}${sufixo}`
}

function etapaAtual(imovel: Imovel | undefined) {
  if (!imovel) return 'Novo cadastro'
  return imovel.status === 'publicado' ? 'Editar' : 'Rascunho'
}

type StatusCep = 'ocioso' | 'buscando' | 'nao-encontrado' | 'falhou'

function FormularioImovel({ imovel }: Readonly<{ imovel?: Imovel }>) {
  const navigate = useNavigate()
  const notificar = useToast()
  const [form, setForm] = useState<FormImovel>(() =>
    imovel ? formDeImovel(imovel) : formVazio(proximoCodigo(lerDb())),
  )
  const [erros, setErros] = useState<ErrosForm>({})
  const [sujo, setSujo] = useState(false)
  const [salvando, setSalvando] = useState<'rascunho' | 'publicar' | null>(null)
  const [marcando, setMarcando] = useState(false)
  const [statusCep, setStatusCep] = useState<StatusCep>('ocioso')
  const [dialogo, setDialogo] = useState<'descartar' | 'excluir' | null>(null)
  const areaManual = useRef(Boolean(imovel?.dimensoes.areaTotal))
  const buscaCep = useRef<AbortController | null>(null)

  const publicado = imovel?.status === 'publicado'

  // Evita perder alterações ao fechar a aba.
  useEffect(() => {
    if (!sujo) return
    const aviso = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', aviso)
    return () => window.removeEventListener('beforeunload', aviso)
  }, [sujo])

  useEffect(() => () => buscaCep.current?.abort(), [])

  const alterar = (parcial: Partial<FormImovel>) => {
    setForm((f) => ({ ...f, ...parcial }))
    setSujo(true)
    setErros((e) => {
      const chaves = Object.keys(parcial) as (keyof FormImovel)[]
      if (!chaves.some((k) => e[k])) return e
      const copia = { ...e }
      chaves.forEach((k) => delete copia[k])
      return copia
    })
  }

  const alterarMedida = (campo: 'frente' | 'fundo', valor: number | null) => {
    const proximo = { ...form, [campo]: valor }
    const parcial: Partial<FormImovel> = { [campo]: valor }
    // Sugere área = frente x fundo até o usuário digitar a área manualmente.
    if (!areaManual.current && proximo.frente && proximo.fundo) {
      parcial.areaTotal = Math.round(proximo.frente * proximo.fundo * 100) / 100
    }
    alterar(parcial)
  }

  const alterarLoteamento = (nome: string) => {
    const lot = buscarLoteamento(nome)
    const parcial: Partial<FormImovel> = { loteamento: nome }
    if (lot) {
      if (!form.cep) parcial.cep = lot.cep
      if (!form.bairro) parcial.bairro = lot.bairro
      if (!form.cidade) parcial.cidade = lot.cidade
      if (!form.uf) parcial.uf = lot.uf
    }
    alterar(parcial)
  }

  const alterarCep = async (valor: string) => {
    const cep = mascaraCep(valor)
    alterar({ cep })
    buscaCep.current?.abort()
    if (cep.length !== 9) {
      setStatusCep('ocioso')
      return
    }
    const controle = new AbortController()
    buscaCep.current = controle
    setStatusCep('buscando')
    try {
      const endereco = await buscarCep(cep, controle.signal)
      if (!endereco) {
        setStatusCep('nao-encontrado')
        return
      }
      setStatusCep('ocioso')
      const parcial: Partial<FormImovel> = {}
      if (endereco.logradouro) parcial.logradouro = endereco.logradouro
      if (endereco.bairro) parcial.bairro = endereco.bairro
      if (endereco.cidade) parcial.cidade = endereco.cidade
      if (endereco.uf) parcial.uf = endereco.uf
      alterar(parcial)
    } catch (error_) {
      if ((error_ as Error).name !== 'AbortError') setStatusCep('falhou')
    }
  }

  const usarLocalizacaoAtual = () => {
    if (!navigator.geolocation) {
      notificar('Seu navegador não permite obter a localização.', 'erro')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        alterar({ lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) }),
      () => notificar('Não foi possível obter sua localização.', 'erro'),
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }

  /** Confere as regras antes de salvar; devolve false e mostra os erros se faltar algo. */
  const validarAntes = (status: 'rascunho' | 'publicado') => {
    if (status === 'rascunho') {
      if (podeSalvarRascunho(form)) return true
      setErros({ titulo: 'Dê ao menos um título para salvar o rascunho.' })
      notificar('Preencha o título para salvar o rascunho.', 'erro')
      return false
    }
    const encontrados = validarPublicacao(form)
    setErros(encontrados)
    const total = Object.keys(encontrados).length
    if (total === 0) return true
    notificar(textoRevisao(total), 'erro')
    requestAnimationFrame(() => {
      const alvo = document.querySelector<HTMLElement>('[aria-invalid="true"], .fotos__zona--erro')
      alvo?.focus()
      alvo?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
    })
    return false
  }

  const concluir = (status: 'rascunho' | 'publicado', salvo: Imovel) => {
    setSujo(false)
    if (status === 'publicado') {
      notificar(publicado ? 'Alterações salvas.' : 'Imóvel publicado com sucesso.')
      navigate('/imoveis')
      return
    }
    notificar('Rascunho salvo.')
    if (!imovel) navigate(`/imoveis/${salvo.id}`, { replace: true })
    setSalvando(null)
  }

  const salvarAsync = async (status: 'rascunho' | 'publicado') => {
    if (!validarAntes(status)) return
    setSalvando(status === 'rascunho' ? 'rascunho' : 'publicar')
    try {
      concluir(status, await salvarImovel({ ...imovelDeForm(form, status), id: imovel?.id }))
    } catch (error_) {
      const mensagem = error_ instanceof Error ? error_.message : 'Não foi possível salvar.'
      if (mensagem.includes('código interno')) setErros((e) => ({ ...e, codigo: 'Código já utilizado.' }))
      notificar(mensagem, 'erro')
      setSalvando(null)
    }
  }

  // salvarAsync já trata os erros esperados; o catch cobre falhas inesperadas.
  const salvar = (status: 'rascunho' | 'publicado') => {
    salvarAsync(status).catch(() => {
      setSalvando(null)
      notificar('Não foi possível salvar.', 'erro')
    })
  }

  const cancelar = () => (sujo ? setDialogo('descartar') : navigate('/imoveis'))

  const lat = lerCoordenada(form.lat)
  const lng = lerCoordenada(form.lng)
  const centroMapa = buscarLoteamento(form.loteamento)?.centro ?? TOLEDO
  const rotuloMapa = rotuloDoLote(form.lote, form.quadra)
  const ocupado = salvando !== null

  return (
    <>
      <header className="cabecalho cabecalho--fixo">
        <div>
          <nav className="migalhas" aria-label="Você está em">
            <Link to="/imoveis">Imóveis</Link>
            <span aria-hidden>›</span>
            <span>{etapaAtual(imovel)}</span>
          </nav>
          <h1 className="cabecalho__titulo">{imovel ? form.titulo || 'Editar imóvel' : 'Cadastrar imóvel'}</h1>
        </div>
        <div className="cabecalho__acoes">
          {imovel && (
            <button type="button" className="btn btn--fantasma-perigo" onClick={() => setDialogo('excluir')} disabled={ocupado}>
              Excluir
            </button>
          )}
          <button type="button" className="btn btn--secundario" onClick={cancelar} disabled={ocupado}>
            Cancelar
          </button>
          {!publicado && (
            <button type="button" className="btn btn--suave" onClick={() => salvar('rascunho')} disabled={ocupado}>
              {salvando === 'rascunho' ? <Spinner /> : null} Salvar rascunho
            </button>
          )}
          <button type="button" className="btn btn--primario" onClick={() => salvar('publicado')} disabled={ocupado}>
            {salvando === 'publicar' ? <Spinner /> : null} {publicado ? 'Salvar alterações' : 'Publicar imóvel'}
          </button>
        </div>
      </header>

      <form
        className="conteudo form-imovel"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          salvar('publicado')
        }}
      >
        <div className="form-imovel__principal">
          <Secao titulo="Identificação" subtitulo="Dados básicos que aparecem no catálogo público">
            <div className="grade">
              <Campo rotulo="Título do anúncio" erro={erros.titulo} className="c-6">
                {(p) => (
                  <input {...p} className="input" placeholder="Ex.: Terreno Biopark 1.300m²" value={form.titulo} onChange={(e) => alterar({ titulo: e.target.value })} />
                )}
              </Campo>
              <Campo rotulo="Matrícula" erro={erros.matricula} className="c-3">
                {(p) => (
                  <input {...p} className="input" placeholder="41.902" value={form.matricula} onChange={(e) => alterar({ matricula: e.target.value })} />
                )}
              </Campo>
              <Campo rotulo="Código interno" erro={erros.codigo} className="c-3">
                {(p) => (
                  <input {...p} className="input" inputMode="numeric" value={form.codigo} onChange={(e) => alterar({ codigo: e.target.value.replace(/\D/g, '') })} />
                )}
              </Campo>
              <Campo rotulo="Tipo do imóvel" erro={erros.tipo} className="c-4">
                {(p) => (
                  <select {...p} className="input select" value={form.tipo} onChange={(e) => alterar({ tipo: e.target.value })}>
                    {TIPOS_IMOVEL.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                )}
              </Campo>
              <Campo rotulo="Loteamento" erro={erros.loteamento} className="c-4">
                {(p) => (
                  <select {...p} className="input select" value={form.loteamento} onChange={(e) => alterarLoteamento(e.target.value)}>
                    <option value="">Selecione</option>
                    {LOTEAMENTOS.map((l) => (
                      <option key={l.nome}>{l.nome}</option>
                    ))}
                  </select>
                )}
              </Campo>
              <Campo rotulo="Situação" className="c-4">
                {(p) => (
                  <select {...p} className="input select" value={form.situacao} onChange={(e) => alterar({ situacao: e.target.value as Situacao })}>
                    {SITUACOES.map((s) => (
                      <option key={s.valor} value={s.valor}>
                        {s.rotulo}
                      </option>
                    ))}
                  </select>
                )}
              </Campo>
            </div>
          </Secao>

          <Secao titulo="Localização" subtitulo="Endereço e identificação no loteamento">
            <div className="grade">
              <Campo
                rotulo="CEP"
                erro={erros.cep ?? (statusCep === 'nao-encontrado' ? 'CEP não encontrado.' : undefined)}
                dica={statusCep === 'falhou' ? 'Consulta indisponível; preencha manualmente.' : undefined}
                className="c-3"
              >
                {(p) => (
                  <div className="input-adorno">
                    <input {...p} className="input" inputMode="numeric" placeholder="00000-000" value={form.cep} onChange={(e) => alterarCep(e.target.value)} />
                    {statusCep === 'buscando' && (
                      <span className="input-adorno__texto" aria-label="Buscando endereço">
                        <Spinner tamanho={14} />
                      </span>
                    )}
                  </div>
                )}
              </Campo>
              <Campo rotulo="Logradouro" erro={erros.logradouro} className="c-7">
                {(p) => <input {...p} className="input" value={form.logradouro} onChange={(e) => alterar({ logradouro: e.target.value })} />}
              </Campo>
              <Campo rotulo="Número" erro={erros.numero} className="c-2">
                {(p) => <input {...p} className="input" placeholder="s/n" value={form.numero} onChange={(e) => alterar({ numero: e.target.value })} />}
              </Campo>
              <Campo rotulo="Bairro" erro={erros.bairro} className="c-3">
                {(p) => <input {...p} className="input" value={form.bairro} onChange={(e) => alterar({ bairro: e.target.value })} />}
              </Campo>
              <Campo rotulo="Cidade" erro={erros.cidade} className="c-3">
                {(p) => <input {...p} className="input" value={form.cidade} onChange={(e) => alterar({ cidade: e.target.value })} />}
              </Campo>
              <Campo rotulo="UF" erro={erros.uf} className="c-2">
                {(p) => (
                  <select {...p} className="input select" value={form.uf} onChange={(e) => alterar({ uf: e.target.value })}>
                    <option value="">—</option>
                    {UFS.map((uf) => (
                      <option key={uf}>{uf}</option>
                    ))}
                  </select>
                )}
              </Campo>
              <Campo rotulo="Quadra" erro={erros.quadra} className="c-2">
                {(p) => <input {...p} className="input" value={form.quadra} onChange={(e) => alterar({ quadra: e.target.value })} />}
              </Campo>
              <Campo rotulo="Lote" erro={erros.lote} className="c-2">
                {(p) => <input {...p} className="input" value={form.lote} onChange={(e) => alterar({ lote: e.target.value })} />}
              </Campo>
            </div>
          </Secao>

          <Secao titulo="Geolocalização" subtitulo="Posição exata usada no mapa do catálogo público">
            <div className="grade">
              <Campo rotulo="Latitude" erro={erros.lat} className="c-5">
                {(p) => <input {...p} className="input" inputMode="decimal" placeholder="-24.713920" value={form.lat} onChange={(e) => alterar({ lat: e.target.value })} />}
              </Campo>
              <Campo rotulo="Longitude" erro={erros.lng} className="c-4">
                {(p) => <input {...p} className="input" inputMode="decimal" placeholder="-53.740310" value={form.lng} onChange={(e) => alterar({ lng: e.target.value })} />}
              </Campo>
              <div className="c-3 grade__botao">
                <button
                  type="button"
                  className={`btn btn--bloco ${marcando ? 'btn--primario' : 'btn--suave'}`}
                  aria-pressed={marcando}
                  onClick={() => setMarcando((m) => !m)}
                >
                  <MapPin size={15} /> {marcando ? 'Cancelar' : 'Marcar no mapa'}
                </button>
              </div>
            </div>
            <MapaLote
              lat={lat}
              lng={lng}
              centroPadrao={centroMapa}
              rotulo={rotuloMapa}
              marcando={marcando}
              onMarcar={(la, ln) => {
                alterar({ lat: la.toFixed(6), lng: ln.toFixed(6) })
                setMarcando(false)
              }}
            />
            <button type="button" className="link link--icone" onClick={usarLocalizacaoAtual}>
              <Crosshair size={13} /> Usar minha localização atual
            </button>
          </Secao>

          <Secao titulo="Dimensões e valores" subtitulo="Medidas da área e condições comerciais">
            <div className="grade">
              <Campo rotulo="Área total" erro={erros.areaTotal} className="c-3">
                {(p) => (
                  <InputNumerico
                    {...p}
                    sufixo="m²"
                    valor={form.areaTotal}
                    onChange={(v) => {
                      areaManual.current = v !== null
                      alterar({ areaTotal: v })
                    }}
                  />
                )}
              </Campo>
              <Campo rotulo="Frente" className="c-3">
                {(p) => <InputNumerico {...p} sufixo="m" valor={form.frente} onChange={(v) => alterarMedida('frente', v)} />}
              </Campo>
              <Campo rotulo="Fundo" className="c-3">
                {(p) => <InputNumerico {...p} sufixo="m" valor={form.fundo} onChange={(v) => alterarMedida('fundo', v)} />}
              </Campo>
              <Campo rotulo="Topografia" className="c-3">
                {(p) => (
                  <select {...p} className="input select" value={form.topografia} onChange={(e) => alterar({ topografia: e.target.value })}>
                    {TOPOGRAFIAS.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                )}
              </Campo>
              <Campo rotulo="Valor de tabela" erro={erros.valorTabela} className="c-4">
                {(p) => <InputNumerico {...p} prefixo="R$" valor={form.valorTabela} onChange={(v) => alterar({ valorTabela: v })} />}
              </Campo>
              <Campo
                rotulo="Valor mínimo aceito"
                erro={erros.valorMinimo}
                dica={
                  form.valorMinimo && form.valorTabela && form.valorMinimo <= form.valorTabela
                    ? `${Math.round((1 - form.valorMinimo / form.valorTabela) * 100)}% abaixo da tabela`
                    : undefined
                }
                className="c-4"
              >
                {(p) => <InputNumerico {...p} prefixo="R$" valor={form.valorMinimo} onChange={(v) => alterar({ valorMinimo: v })} />}
              </Campo>
              <Campo rotulo="Prazo de reserva" className="c-4">
                {(p) => (
                  <select
                    {...p}
                    className="input select"
                    value={form.prazoReservaHoras}
                    onChange={(e) => alterar({ prazoReservaHoras: Number(e.target.value) })}
                  >
                    {PRAZOS_RESERVA.map((pr) => (
                      <option key={pr.horas} value={pr.horas}>
                        {pr.rotulo}
                      </option>
                    ))}
                  </select>
                )}
              </Campo>
            </div>
          </Secao>
        </div>

        <aside className="form-imovel__lateral">
          <Secao titulo="Fotos do imóvel" subtitulo="A primeira imagem vira a capa">
            <FotosImovel
              fotos={form.fotos}
              erro={erros.fotos}
              onChange={(fotos) => alterar({ fotos })}
              onAviso={(m) => notificar(m, 'erro')}
            />
          </Secao>
          <Secao titulo="Publicação">
            <div className="toggles">
              <Toggle rotulo="Exibir no catálogo público" ativo={form.catalogo} onChange={(v) => alterar({ catalogo: v, ...(v ? {} : { destaque: false }) })} />
              <Toggle rotulo="Aceitar reservas online" ativo={form.reservasOnline} onChange={(v) => alterar({ reservasOnline: v })} />
              <Toggle
                rotulo="Destacar na home"
                ativo={form.destaque}
                desabilitado={!form.catalogo}
                onChange={(v) => alterar({ destaque: v })}
              />
            </div>
          </Secao>
        </aside>
      </form>

      <Dialogo
        aberto={dialogo === 'descartar'}
        titulo="Descartar alterações?"
        descricao="As informações que você preencheu e não salvou serão perdidas."
        textoConfirmar="Descartar"
        textoCancelar="Continuar editando"
        perigoso
        onCancelar={() => setDialogo(null)}
        onConfirmar={() => {
          setSujo(false)
          setDialogo(null)
          navigate('/imoveis')
        }}
      />
      <Dialogo
        aberto={dialogo === 'excluir'}
        titulo="Excluir imóvel?"
        descricao="Esta ação não pode ser desfeita."
        textoConfirmar="Excluir"
        perigoso
        onCancelar={() => setDialogo(null)}
        onConfirmar={async () => {
          if (!imovel) return
          try {
            await excluirImovel(imovel.id)
            setSujo(false)
            notificar('Imóvel excluído.', 'info')
            navigate('/imoveis', { replace: true })
          } catch (error_) {
            setDialogo(null)
            notificar(error_ instanceof Error ? error_.message : 'Não foi possível excluir.', 'erro')
          }
        }}
      />
    </>
  )
}

function Secao({ titulo, subtitulo, children }: Readonly<{ titulo: string; subtitulo?: string; children: ReactNode }>) {
  return (
    <section className="card secao">
      <div className="secao__cabecalho">
        <h2 className="card__titulo">{titulo}</h2>
        {subtitulo && <p className="card__subtitulo">{subtitulo}</p>}
      </div>
      {children}
    </section>
  )
}
