import { Grid3x3, SquarePlus } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { Dialogo } from '../../components/Dialogo'
import { InputNumerico } from '../../components/InputNumerico'
import { Badge, Campo, Spinner } from '../../components/ui'
import { useToast } from '../../contexts/ToastContext'
import { SITUACOES_LOTEAMENTO, UFS } from '../../data/catalogos'
import { useDb } from '../../data/db'
import { resumoQuadras } from '../../data/selectors'
import type { Loteamento, SituacaoLoteamento } from '../../data/types'
import { formatarMoedaCompacta, mascaraCep } from '../../lib/format'
import { buscarCep, salvarLoteamento } from '../../services/api'

type Form = Omit<Loteamento, 'id' | 'centro'> & { coordenadas: string }

const vazio: Form = {
  nome: '',
  codigo: '',
  situacao: 'em_aprovacao',
  dataAprovacao: '',
  cep: '',
  endereco: '',
  bairro: '',
  cidade: '',
  uf: 'PR',
  matriculaMae: '',
  areaTotal: null,
  areaLoteavel: null,
  coordenadas: '',
  cartorio: '',
  numeroRegistro: '',
  licencaAmbiental: '',
  validadeLicenca: '',
}

/** "-24.7239, -53.7412" → { lat, lng } */
function lerCoordenadas(texto: string) {
  const partes = texto.split(/[,;\s]+/).filter(Boolean).map(Number)
  if (partes.length !== 2 || partes.some((n) => !Number.isFinite(n))) return null
  const [lat, lng] = partes
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  return { lat, lng }
}

function validar(f: Form) {
  const e: Partial<Record<keyof Form, string>> = {}
  if (f.nome.trim().length < 3) e.nome = 'Informe o nome do loteamento.'
  if (!/^[A-Za-z0-9-]{2,10}$/.test(f.codigo.trim())) e.codigo = 'Use de 2 a 10 letras, números ou hífen.'
  if (f.cep.replace(/\D/g, '').length !== 8) e.cep = 'CEP deve ter 8 dígitos.'
  if (!f.endereco.trim()) e.endereco = 'Informe o endereço.'
  if (!f.cidade.trim()) e.cidade = 'Informe a cidade.'
  if (f.coordenadas.trim() && !lerCoordenadas(f.coordenadas)) e.coordenadas = 'Use o formato -24.7239, -53.7412.'
  if (f.areaTotal && f.areaLoteavel && f.areaLoteavel > f.areaTotal) e.areaLoteavel = 'Não pode ser maior que a área total.'
  if (f.situacao === 'em_comercializacao' && !f.numeroRegistro.trim()) {
    e.numeroRegistro = 'Obrigatório para liberar a comercialização.'
  }
  return e
}

export function LoteamentoFormPage() {
  const { id } = useParams()
  const db = useDb()
  const loteamento = id ? db.loteamentos.find((l) => l.id === id) : undefined
  if (id && !loteamento) {
    return (
      <main className="conteudo">
        <section className="card vazio">
          <h2>Loteamento não encontrado</h2>
          <Link to="/imoveis/loteamentos" className="btn btn--secundario">Voltar</Link>
        </section>
      </main>
    )
  }
  return <FormLoteamento key={id ?? 'novo'} loteamento={loteamento} />
}

function FormLoteamento({ loteamento }: { loteamento?: Loteamento }) {
  const db = useDb()
  const navigate = useNavigate()
  const notificar = useToast()
  const [form, setForm] = useState<Form>(() =>
    loteamento
      ? { ...loteamento, coordenadas: loteamento.centro ? `${loteamento.centro.lat}, ${loteamento.centro.lng}` : '' }
      : vazio,
  )
  const [erros, setErros] = useState<Partial<Record<keyof Form, string>>>({})
  const [sujo, setSujo] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [descartar, setDescartar] = useState(false)
  const quadras = loteamento ? resumoQuadras(db, loteamento.nome) : []

  const alterar = (parcial: Partial<Form>) => {
    setForm((f) => ({ ...f, ...parcial }))
    setSujo(true)
    setErros((e) => {
      const c = { ...e }
      for (const k of Object.keys(parcial)) delete c[k as keyof Form]
      return c
    })
  }

  const alterarCep = async (valor: string) => {
    const cep = mascaraCep(valor)
    alterar({ cep })
    if (cep.length !== 9) return
    try {
      const end = await buscarCep(cep)
      if (end) {
        alterar({
          ...(end.logradouro && !form.endereco ? { endereco: end.logradouro } : {}),
          ...(end.bairro ? { bairro: end.bairro } : {}),
          cidade: end.cidade,
          uf: end.uf,
        })
      }
    } catch {
      // Sem internet: segue com preenchimento manual.
    }
  }

  const salvar = async () => {
    const e = validar(form)
    setErros(e)
    if (Object.keys(e).length) {
      notificar('Revise os campos destacados.', 'erro')
      return
    }
    setSalvando(true)
    try {
      const { coordenadas, ...resto } = form
      const salvo = await salvarLoteamento({ ...resto, centro: lerCoordenadas(coordenadas), id: loteamento?.id })
      setSujo(false)
      notificar(loteamento ? 'Loteamento atualizado.' : 'Loteamento cadastrado. Agora cadastre as quadras.')
      navigate(`/imoveis/loteamentos/${salvo.id}`, { replace: true })
    } catch (err) {
      notificar(err instanceof Error ? err.message : 'Não foi possível salvar.', 'erro')
    } finally {
      setSalvando(false)
    }
  }

  const texto = (campo: keyof Form, rotulo: string, classe: string, extra: Record<string, string> = {}) => (
    <Campo rotulo={rotulo} erro={erros[campo]} className={classe}>
      {(p) => <input {...p} {...extra} className="input" value={String(form[campo] ?? '')} onChange={(e) => alterar({ [campo]: e.target.value })} />}
    </Campo>
  )

  return (
    <>
      <header className="cabecalho cabecalho--fixo">
        <div>
          <nav className="migalhas" aria-label="Você está em">
            <Link to="/imoveis">Imóveis</Link>
            <span aria-hidden>›</span>
            <Link to="/imoveis/loteamentos">Loteamentos</Link>
            <span aria-hidden>›</span>
            <span>{loteamento ? loteamento.nome : 'Novo loteamento'}</span>
          </nav>
          <h1 className="cabecalho__titulo">{loteamento ? loteamento.nome : 'Novo loteamento'}</h1>
          <p className="cabecalho__subtitulo">Cadastro do empreendimento e da hierarquia loteamento, quadra e lote · RF03 e RF04</p>
        </div>
        <div className="cabecalho__acoes">
          {loteamento && (
            <Link to={`/imoveis/loteamentos/${loteamento.id}/mapa`} className="btn btn--secundario">
              <Grid3x3 size={15} /> Ver mapa
            </Link>
          )}
          <button type="button" className="btn btn--secundario" onClick={() => (sujo ? setDescartar(true) : navigate('/imoveis/loteamentos'))}>
            Cancelar
          </button>
          <button type="button" className="btn btn--primario" onClick={salvar} disabled={salvando}>
            {salvando && <Spinner />} Salvar loteamento
          </button>
        </div>
      </header>

      <main className="conteudo pilha">
        <section className="card secao">
          <div className="secao__cabecalho">
            <h2 className="card__titulo">Identificação</h2>
            <p className="card__subtitulo">O código do loteamento entra no início do identificador de cada lote.</p>
          </div>
          <div className="grade">
            {texto('nome', 'Nome do loteamento', 'c-5', { placeholder: 'Universitário I' })}
            <Campo rotulo="Código" erro={erros.codigo} className="c-2">
              {(p) => <input {...p} className="input" placeholder="UNI-I" value={form.codigo} onChange={(e) => alterar({ codigo: e.target.value.toUpperCase() })} />}
            </Campo>
            <Campo rotulo="Situação" className="c-3">
              {(p) => (
                <select {...p} className="input select" value={form.situacao} onChange={(e) => alterar({ situacao: e.target.value as SituacaoLoteamento })}>
                  {SITUACOES_LOTEAMENTO.map((s) => <option key={s.valor} value={s.valor}>{s.rotulo}</option>)}
                </select>
              )}
            </Campo>
            {texto('dataAprovacao', 'Data de aprovação', 'c-2', { type: 'date' })}
          </div>
        </section>

        <section className="card secao">
          <div className="secao__cabecalho">
            <h2 className="card__titulo">Localização e áreas</h2>
            <p className="card__subtitulo">A coordenada do loteamento serve de referência para o mapa interno.</p>
          </div>
          <div className="grade">
            <Campo rotulo="CEP" erro={erros.cep} className="c-2">
              {(p) => <input {...p} className="input" inputMode="numeric" placeholder="85903-000" value={form.cep} onChange={(e) => alterarCep(e.target.value)} />}
            </Campo>
            {texto('endereco', 'Endereço', 'c-5', { placeholder: 'Rod. PR-317, km 12' })}
            {texto('bairro', 'Bairro ou região', 'c-3')}
            {texto('cidade', 'Cidade', 'c-1')}
            <Campo rotulo="UF" className="c-1">
              {(p) => (
                <select {...p} className="input select" value={form.uf} onChange={(e) => alterar({ uf: e.target.value })}>
                  {UFS.map((u) => <option key={u}>{u}</option>)}
                </select>
              )}
            </Campo>
            {texto('matriculaMae', 'Matrícula-mãe', 'c-3')}
            <Campo rotulo="Área total" className="c-3">
              {(p) => <InputNumerico {...p} sufixo="m²" valor={form.areaTotal} onChange={(v) => alterar({ areaTotal: v })} />}
            </Campo>
            <Campo rotulo="Área loteável" erro={erros.areaLoteavel} className="c-3">
              {(p) => <InputNumerico {...p} sufixo="m²" valor={form.areaLoteavel} onChange={(v) => alterar({ areaLoteavel: v })} />}
            </Campo>
            {texto('coordenadas', 'Coordenadas', 'c-3', { placeholder: '-24.7239, -53.7412' })}
          </div>
        </section>

        <section className="card secao">
          <div className="secao__cabecalho">
            <h2 className="card__titulo">Registro e licenças</h2>
            <p className="card__subtitulo">Documentação exigida para liberar a comercialização.</p>
          </div>
          <div className="grade">
            {texto('cartorio', 'Cartório de registro', 'c-3', { placeholder: '1º Ofício de Toledo' })}
            {texto('numeroRegistro', 'Número do registro', 'c-3', { placeholder: 'R-4/38.771' })}
            {texto('licencaAmbiental', 'Licença ambiental', 'c-3', { placeholder: 'IAT-2024-0871' })}
            {texto('validadeLicenca', 'Validade da licença', 'c-3', { type: 'date' })}
          </div>
        </section>

        <section className="card">
          <div className="card__cabecalho">
            <div>
              <h2 className="card__titulo">Quadras do loteamento</h2>
              <p className="card__subtitulo">Cada quadra agrupa os lotes e herda o código do loteamento · RF04</p>
            </div>
            {loteamento && (
              <Link to={`/imoveis/loteamentos/${loteamento.id}/quadras/nova`} className="btn btn--secundario btn--pequeno">
                <SquarePlus size={13} /> Nova quadra
              </Link>
            )}
          </div>
          {!loteamento ? (
            <p className="card__vazio">Salve o loteamento para cadastrar as quadras.</p>
          ) : quadras.length === 0 ? (
            <p className="card__vazio">Nenhuma quadra ainda.</p>
          ) : (
            <div className="tabela-wrap">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Quadra</th><th>Lotes</th><th>Disponíveis</th><th>Reservados</th><th>Vendidos</th><th>Área média</th><th>Faixa de preço</th><th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {quadras.map((q) => (
                    <tr key={q.id}>
                      <td className="tabela__destaque">
                        <Link to={`/imoveis?loteamento=${encodeURIComponent(loteamento.nome)}&quadra=${q.identificacao}`}>
                          {q.identificacao ? `Qd. ${q.identificacao}` : 'Sem quadra'}
                        </Link>
                      </td>
                      <td>{q.lotes}</td>
                      <td>{q.disponiveis}</td>
                      <td>{q.reservados}</td>
                      <td>{q.vendidos}</td>
                      <td>{q.areaMedia ? `${q.areaMedia.toLocaleString('pt-BR')} m²` : '—'}</td>
                      <td>{q.precoMin ? `${formatarMoedaCompacta(q.precoMin)} a ${formatarMoedaCompacta(q.precoMax!)}` : '—'}</td>
                      <td><Badge variante={q.situacao.variante}>{q.situacao.rotulo}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
      <Dialogo
        aberto={descartar}
        titulo="Descartar alterações?"
        descricao="As informações não salvas serão perdidas."
        textoConfirmar="Descartar"
        textoCancelar="Continuar editando"
        perigoso
        onCancelar={() => setDescartar(false)}
        onConfirmar={() => navigate('/imoveis/loteamentos')}
      />
    </>
  )
}
