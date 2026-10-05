import { Download, FileSpreadsheet } from 'lucide-react'
import { useRef, useState } from 'react'

import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useDb } from '../data/db'
import type { Db, Imovel, Situacao } from '../data/types'
import { importarImoveis } from '../services/api'
import { Dialogo } from './Dialogo'

const COLUNAS = ['loteamento', 'quadra', 'lote', 'matricula', 'area', 'frente', 'fundo', 'valor_tabela', 'situacao']
const EXEMPLO = ['Lot. Universitário', '07', '01', '', '420', '14', '30', '178000', 'disponivel']
// Marca de ordem de bytes: faz o Excel abrir o CSV como UTF-8.
const BOM = String.fromCharCode(0xfeff)
const BOM_INICIAL = new RegExp(`^${BOM}`)

type Novo = Omit<Imovel, 'id' | 'codigo' | 'criadoEm' | 'atualizadoEm'>

interface Resultado {
  validos: Novo[]
  erros: string[]
}

/** Aceita "1.300,50", "1300,5" ou "1300.5". */
function numero(texto: string) {
  const t = texto.trim()
  if (!t) return null
  const normalizado = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t
  const n = Number(normalizado.replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : NaN
}

function lerCsv(texto: string) {
  const linhas = texto.replace(BOM_INICIAL, '').split(/\r?\n/).filter((l) => l.trim())
  const separador = (linhas[0]?.match(/;/g)?.length ?? 0) >= (linhas[0]?.match(/,/g)?.length ?? 0) ? ';' : ','
  return linhas.map((l) => l.split(separador).map((c) => c.trim().replace(/^"|"$/g, '')))
}

function validar(texto: string, db: Db): Resultado {
  const [cabecalho, ...linhas] = lerCsv(texto)
  if (!cabecalho) return { validos: [], erros: ['A planilha está vazia.'] }
  const indice = Object.fromEntries(COLUNAS.map((c) => [c, cabecalho.map((h) => h.toLowerCase()).indexOf(c)]))
  const faltando = ['loteamento', 'lote', 'area', 'valor_tabela'].filter((c) => indice[c] < 0)
  if (faltando.length) return { validos: [], erros: [`Colunas obrigatórias ausentes: ${faltando.join(', ')}.`] }

  const validos: Novo[] = []
  const erros: string[] = []
  const vistos = new Set<string>()
  linhas.forEach((cols, n) => {
    const linha = n + 2
    const campo = (c: string) => (indice[c] >= 0 ? (cols[indice[c]] ?? '') : '')
    const lot = db.loteamentos.find((l) => l.nome.toLowerCase() === campo('loteamento').toLowerCase())
    const quadra = campo('quadra').padStart(campo('quadra') ? 2 : 0, '0')
    const lote = campo('lote').padStart(2, '0')
    const area = numero(campo('area'))
    const frente = numero(campo('frente'))
    const fundo = numero(campo('fundo'))
    const valor = numero(campo('valor_tabela'))
    const situacao = (campo('situacao').toLowerCase() || 'disponivel') as Situacao
    const chave = `${lot?.nome}|${quadra}|${lote}`
    const problemas: string[] = []
    if (!lot) problemas.push(`loteamento "${campo('loteamento')}" não cadastrado`)
    if (!campo('lote')) problemas.push('lote vazio')
    if (!area || Number.isNaN(area)) problemas.push('área inválida')
    if (!valor || Number.isNaN(valor)) problemas.push('valor inválido')
    if (Number.isNaN(frente) || Number.isNaN(fundo)) problemas.push('frente/fundo inválidos')
    if (!['disponivel', 'bloqueado'].includes(situacao)) problemas.push('situação deve ser disponivel ou bloqueado')
    if (
      vistos.has(chave) ||
      db.imoveis.some((i) => i.loteamento === lot?.nome && i.endereco.quadra === quadra && i.endereco.lote === lote)
    ) {
      problemas.push('lote já existe')
    }
    if (problemas.length || !lot) {
      erros.push(`Linha ${linha}: ${problemas.join('; ')}.`)
      return
    }
    vistos.add(chave)
    const centro = lot.centro ?? { lat: -24.7246, lng: -53.7412 }
    const agora = new Date().toISOString()
    validos.push({
      titulo: `Terreno ${area!.toLocaleString('pt-BR')}m² — ${lot.nome}`,
      matricula: campo('matricula').replace(/\D/g, ''),
      tipo: 'Terreno em loteamento',
      loteamento: lot.nome,
      situacao,
      endereco: { cep: lot.cep, logradouro: lot.endereco, numero: 's/n', bairro: lot.bairro, cidade: lot.cidade, uf: lot.uf, quadra, lote },
      geo: { lat: centro.lat, lng: centro.lng },
      dimensoes: { areaTotal: area, frente, fundo, topografia: 'Plano' },
      valores: { tabela: valor, minimo: Math.round((valor! * 0.92) / 500) * 500, prazoReservaHoras: 72 },
      // Sem fotos ainda: entra fora do catálogo até ser revisado.
      publicacao: { catalogo: false, reservasOnline: true, destaque: false },
      fotos: [],
      bloqueio: situacao === 'bloqueado' ? { motivo: 'Outro', justificativa: 'Bloqueado na importação.', em: agora } : undefined,
      status: 'publicado',
    })
  })
  return { validos, erros }
}

function textoImportar(importando: boolean, qtd: number) {
  if (importando) return 'Importando…'
  if (!qtd) return 'Importar'
  return qtd === 1 ? 'Importar 1 lote' : `Importar ${qtd} lotes`
}

function baixarModelo() {
  const conteudo = `${BOM}${COLUNAS.join(';')}\n${EXEMPLO.join(';')}\n`
  const url = URL.createObjectURL(new Blob([conteudo], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'modelo-importacao-imoveis.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export function ImportarPlanilha({ aberto, onFechar }: Readonly<{ aberto: boolean; onFechar: () => void }>) {
  const db = useDb()
  const { usuario } = useAuth()
  const notificar = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [arquivo, setArquivo] = useState('')
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [importando, setImportando] = useState(false)

  const fechar = () => {
    setArquivo('')
    setResultado(null)
    onFechar()
  }

  const ler = async (file: File) => {
    setArquivo(file.name)
    if (!/\.csv$/i.test(file.name)) {
      setResultado({ validos: [], erros: ['Envie um arquivo .csv (no Excel: Salvar como → CSV UTF-8).'] })
      return
    }
    setResultado(validar(await file.text(), db))
  }

  const importar = async () => {
    if (!resultado?.validos.length) return
    setImportando(true)
    try {
      const n = await importarImoveis(resultado.validos, usuario?.nome ?? 'Administrador')
      notificar(`${n} ${n === 1 ? 'lote importado' : 'lotes importados'}. Eles entram fora do catálogo até receberem fotos.`)
      fechar()
    } catch (error_) {
      notificar(error_ instanceof Error ? error_.message : 'Não foi possível importar.', 'erro')
    } finally {
      setImportando(false)
    }
  }

  const qtd = resultado?.validos.length ?? 0
  return (
    <Dialogo
      aberto={aberto}
      largo
      titulo="Importar planilha de lotes"
      descricao="Cadastre vários lotes de uma vez a partir de um arquivo CSV. Lotes com erro são ignorados."
      textoConfirmar={textoImportar(importando, qtd)}
      confirmarDesabilitado={!qtd}
      carregando={importando}
      onCancelar={fechar}
      onConfirmar={importar}
    >
      <div className="importar">
        <button type="button" className="fotos__zona" onClick={() => inputRef.current?.click()}>
          <FileSpreadsheet size={20} aria-hidden />
          <strong>{arquivo || 'Escolher arquivo .csv'}</strong>
          <small>Colunas: {COLUNAS.join(', ')}</small>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          hidden
          aria-label="Selecionar planilha"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) ler(f).catch(() => setResultado({ validos: [], erros: ['Não foi possível ler o arquivo.'] }))
            e.target.value = ''
          }}
        />
        <button type="button" className="link" onClick={baixarModelo}>
          <Download size={13} /> Baixar planilha modelo
        </button>
        {resultado && (
          <div className="importar__resultado">
            <output>
              <strong>{qtd}</strong> {qtd === 1 ? 'lote pronto' : 'lotes prontos'} para importar
              {resultado.erros.length > 0 && (
                <>
                  {' · '}
                  <strong>{resultado.erros.length}</strong> com erro
                </>
              )}
            </output>
            {resultado.erros.length > 0 && (
              <ul className="importar__erros">
                {resultado.erros.slice(0, 8).map((e) => (
                  <li key={e}>{e}</li>
                ))}
                {resultado.erros.length > 8 && <li>… e mais {resultado.erros.length - 8}.</li>}
              </ul>
            )}
          </div>
        )}
      </div>
    </Dialogo>
  )
}
