import { Printer } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import { Logo } from '../../components/Logo'
import { useAuth } from '../../contexts/AuthContext'
import { useDb } from '../../data/db'
import { rotuloImovel } from '../../data/selectors'
import type { EnderecoCliente, SituacaoVersao } from '../../data/types'
import { formatarDecimal, formatarMoedaInteira } from '../../lib/format'
import {
  calcularCondicoes,
  formatarParcelas,
  formatarPercentual,
  formatarValidade,
  SITUACAO_VERSAO,
  situacaoVersao,
  versaoAtual,
} from '../../lib/propostas'
import { formatarData } from '../../lib/reservas'
import { useAgora } from '../../lib/useAgora'
import { dataHora, montarLinhas } from './proposta'

/** Só estas versões representam uma oferta vigente ou aceita; as demais saem marcadas como sem validade. */
const VERSOES_VALIDAS: SituacaoVersao[] = ['em_analise', 'contraproposta', 'aprovada']

function formatarEndereco(e: EnderecoCliente | undefined) {
  if (!e?.logradouro) return '—'
  const rua = [e.logradouro, e.numero, e.complemento].filter(Boolean).join(', ')
  const cidade = [e.cidade, e.uf].filter(Boolean).join('/')
  return [rua, e.bairro, cidade, e.cep && `CEP ${e.cep}`].filter(Boolean).join(' · ')
}

/** Documento da proposta para visualização e impressão/PDF (via impressão do navegador). */
export function PropostaDocumentoPage() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const db = useDb()
  const agora = useAgora()
  const { usuario } = useAuth()

  const proposta = db.propostas.find((p) => p.id === id)
  const numeroPedido = Number(params.get('versao'))
  const versao = proposta?.versoes.find((v) => v.numero === numeroPedido) ?? (proposta && versaoAtual(proposta))

  // O título da aba vira o nome sugerido do arquivo ao salvar como PDF.
  useEffect(() => {
    if (!proposta || !versao) return
    const anterior = document.title
    document.title = `${proposta.codigo}-v${versao.numero}`
    return () => {
      document.title = anterior
    }
  }, [proposta, versao])

  if (!proposta || !versao) {
    return (
      <main className="conteudo">
        <section className="card vazio">
          <h2>Proposta não encontrada</h2>
          <Link to="/propostas" className="btn btn--secundario">
            Voltar para propostas
          </Link>
        </section>
      </main>
    )
  }

  const [linha] = montarLinhas(db, [proposta], agora)
  const { imovel, cliente } = linha
  const c = versao.condicoes
  const calculo = calcularCondicoes(c)
  const atual = versao.numero === versaoAtual(proposta).numero
  const situacao = situacaoVersao(proposta, versao, agora)
  const valida = VERSOES_VALIDAS.includes(situacao)
  const documento = cliente?.tipoPessoa === 'juridica' ? 'CNPJ' : 'CPF'

  return (
    <>
      <header className="cabecalho nao-imprimir">
        <div>
          <nav className="migalhas" aria-label="Você está em">
            <Link to="/propostas">Propostas</Link>
            <span aria-hidden>›</span>
            <Link to={`/propostas/${proposta.id}`}>{proposta.codigo}</Link>
            <span aria-hidden>›</span>
            <span>Documento</span>
          </nav>
          <h1 className="cabecalho__titulo">Documento da proposta</h1>
          <p className="cabecalho__subtitulo">Confira o documento e use “Imprimir / salvar PDF” para gerar o arquivo.</p>
        </div>
        <div className="cabecalho__acoes">
          {proposta.versoes.length > 1 && (
            <label className="documento__versao">
              <span>Versão</span>
              <select
                className="input"
                value={versao.numero}
                onChange={(e) => setParams({ versao: e.target.value }, { replace: true })}
              >
                {[...proposta.versoes].reverse().map((v) => (
                  <option key={v.numero} value={v.numero}>
                    v{v.numero} — {SITUACAO_VERSAO[situacaoVersao(proposta, v, agora)].rotulo}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button type="button" className="btn btn--primario" onClick={() => window.print()}>
            <Printer size={15} /> Imprimir / salvar PDF
          </button>
        </div>
      </header>

      <main className="conteudo documento">
        <article className="folha" aria-label={`Proposta ${proposta.codigo}, versão ${versao.numero}`}>
          <header className="folha__topo">
            <Logo comSlogan />
            <div className="folha__identificacao">
              <p className="folha__titulo">Proposta de compra</p>
              <p>
                <strong>{proposta.codigo}</strong> · versão v{versao.numero}
              </p>
              <p>Emitida em {formatarData(versao.enviadaEm ?? versao.criadaEm)}</p>
            </div>
          </header>

          {!valida && (
            <p className="folha__aviso" role="note">
              Documento sem validade comercial — versão {SITUACAO_VERSAO[situacao].rotulo.toLowerCase()}.
            </p>
          )}

          <section className="folha__secao">
            <h2>Proponente</h2>
            <dl className="folha__ficha">
              <div className="folha__largo"><dt>Nome</dt><dd>{linha.clienteNome}</dd></div>
              <div><dt>{documento}</dt><dd>{cliente?.cpfCnpj || '—'}</dd></div>
              {cliente?.tipoPessoa !== 'juridica' && (
                <>
                  <div><dt>Estado civil</dt><dd>{cliente?.estadoCivil || '—'}</dd></div>
                  <div><dt>Profissão</dt><dd>{cliente?.profissao || '—'}</dd></div>
                </>
              )}
              <div><dt>Telefone</dt><dd>{cliente?.telefone || '—'}</dd></div>
              <div><dt>E-mail</dt><dd>{cliente?.email || '—'}</dd></div>
              <div className="folha__largo"><dt>Endereço</dt><dd>{formatarEndereco(cliente?.endereco)}</dd></div>
            </dl>
          </section>

          <section className="folha__secao">
            <h2>Imóvel</h2>
            <dl className="folha__ficha">
              <div className="folha__largo"><dt>Identificação</dt><dd>{imovel ? rotuloImovel(imovel) : linha.imovelRotulo}</dd></div>
              <div><dt>Código</dt><dd>{imovel?.codigo ?? '—'}</dd></div>
              <div><dt>Matrícula</dt><dd>{imovel?.matricula || '—'}</dd></div>
              <div><dt>Área total</dt><dd>{imovel?.dimensoes.areaTotal ? `${formatarDecimal(imovel.dimensoes.areaTotal)} m²` : '—'}</dd></div>
              <div>
                <dt>Frente × fundo</dt>
                <dd>
                  {imovel?.dimensoes.frente && imovel.dimensoes.fundo
                    ? `${formatarDecimal(imovel.dimensoes.frente)} × ${formatarDecimal(imovel.dimensoes.fundo)} m`
                    : '—'}
                </dd>
              </div>
            </dl>
          </section>

          <section className="folha__secao">
            <h2>Valores</h2>
            <table className="folha__tabela">
              <tbody>
                <tr><th scope="row">Valor de tabela</th><td>{formatarMoedaInteira(c.valorTabela)}</td></tr>
                <tr>
                  <th scope="row">Desconto</th>
                  <td>{c.descontoPercentual > 0 ? `−${formatarPercentual(c.descontoPercentual)}` : formatarPercentual(0)}</td>
                </tr>
                <tr className="folha__total"><th scope="row">Valor proposto</th><td>{formatarMoedaInteira(calculo.valorProposto)}</td></tr>
              </tbody>
            </table>
          </section>

          <section className="folha__secao">
            <h2>Condições de pagamento</h2>
            <dl className="folha__ficha">
              <div><dt>Forma</dt><dd>{c.formaPagamento || '—'}</dd></div>
              <div><dt>Entrada</dt><dd>{formatarMoedaInteira(c.entrada)} ({formatarPercentual(calculo.entradaPercentual)})</dd></div>
              <div><dt>Parcelas</dt><dd>{formatarParcelas(c.parcelas, calculo.valorParcela)}</dd></div>
              <div><dt>Primeira parcela</dt><dd>{formatarData(c.primeiroVencimento)}</dd></div>
              <div><dt>Índice de correção</dt><dd>{c.indiceCorrecao}</dd></div>
              <div><dt>Escritura</dt><dd>{c.escritura}</dd></div>
              <div><dt>Garantia</dt><dd>{c.garantia}</dd></div>
              <div>
                <dt>Validade</dt>
                <dd>
                  {formatarValidade(c.validadeDias)}
                  {atual && proposta.expiraEm ? ` · até ${formatarData(proposta.expiraEm)}` : ''}
                </dd>
              </div>
            </dl>
          </section>

          {versao.observacoes && (
            <section className="folha__secao">
              <h2>Observações</h2>
              <p className="folha__texto">{versao.observacoes}</p>
            </section>
          )}

          <p className="folha__texto folha__declaracao">
            O proponente declara ter conhecimento das condições acima e manifesta interesse na aquisição do imóvel descrito. Esta
            proposta não constitui contrato e só produz efeitos após aprovação pela Urbizzi e assinatura do instrumento definitivo.
          </p>

          <div className="folha__assinaturas">
            <div><span>{linha.clienteNome}</span><small>Proponente</small></div>
            <div><span>{linha.corretorNome}</span><small>Corretor responsável</small></div>
            <div><span>Urbizzi</span><small>Aprovação</small></div>
          </div>

          <footer className="folha__rodape">
            {proposta.codigo} · v{versao.numero} · gerado em {dataHora(new Date(agora).toISOString())}
            {usuario ? ` por ${usuario.nome}` : ''}
          </footer>
        </article>
      </main>
    </>
  )
}
