import { CheckCircle2 } from 'lucide-react'
import { useState } from 'react'

import { Dialogo } from '../../components/Dialogo'
import { Campo } from '../../components/ui'
import type { Imovel } from '../../data/types'
import { formatarMoedaInteira } from '../../lib/format'
import { rotuloImovel } from '../../data/selectors'
import { registrarInteresse } from '../../services/api'

// Partes separadas por pontos sem sobreposição: evita retrocesso exponencial na regex.
const EMAIL = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/

function mascaraTelefone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d ? `(${d}` : ''
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

interface Props {
  imovel: Imovel | null
  mensagemInicial?: string
  onFechar: () => void
}

/** Formulário "Tenho interesse": registra o contato sem criar conta (RF). */
export function InteresseDialogo({ imovel, mensagemInicial = '', onFechar }: Readonly<Props>) {
  const [dados, setDados] = useState({ nome: '', email: '', telefone: '', mensagem: mensagemInicial })
  const [erros, setErros] = useState<Record<string, string>>({})
  const [enviando, setEnviando] = useState(false)
  const [protocolo, setProtocolo] = useState('')
  const [erroEnvio, setErroEnvio] = useState('')

  if (!imovel) return null

  const alterar = (parcial: Partial<typeof dados>) => {
    setDados((d) => ({ ...d, ...parcial }))
    setErros((e) => {
      const c = { ...e }
      for (const k of Object.keys(parcial)) delete c[k]
      return c
    })
  }

  const enviar = async () => {
    const e: Record<string, string> = {}
    if (dados.nome.trim().split(/\s+/).length < 2) e.nome = 'Informe nome e sobrenome.'
    if (!EMAIL.test(dados.email.trim())) e.email = 'E-mail inválido.'
    if (dados.telefone.replace(/\D/g, '').length < 10) e.telefone = 'Telefone com DDD.'
    setErros(e)
    if (Object.keys(e).length) return
    setEnviando(true)
    setErroEnvio('')
    try {
      setProtocolo(await registrarInteresse(imovel.id, { ...dados, nome: dados.nome.trim(), email: dados.email.trim() }))
    } catch (error_) {
      setErroEnvio(error_ instanceof Error ? error_.message : 'Não foi possível enviar agora.')
    } finally {
      setEnviando(false)
    }
  }

  const resumo = [
    rotuloImovel(imovel, false),
    imovel.loteamento,
    imovel.dimensoes.areaTotal ? `${imovel.dimensoes.areaTotal.toLocaleString('pt-BR')} m²` : null,
    imovel.valores.tabela ? formatarMoedaInteira(imovel.valores.tabela) : null,
  ]
    .filter(Boolean)
    .join(' · ')

  if (protocolo) {
    return (
      <Dialogo aberto titulo="Interesse enviado!" textoConfirmar="Fechar" semCancelar onCancelar={onFechar} onConfirmar={onFechar}>
        <div className="interesse-ok">
          <CheckCircle2 size={36} aria-hidden />
          <output>
            Obrigado, {dados.nome.trim().split(' ')[0]}! Um corretor da Urbizzi vai entrar em contato pelo telefone ou e-mail
            informado.
          </output>
          <p className="texto-fraco">Protocolo: {protocolo}</p>
        </div>
      </Dialogo>
    )
  }

  return (
    <Dialogo
      aberto
      largo
      titulo="Tenho interesse neste imóvel"
      descricao={resumo}
      textoConfirmar={enviando ? 'Enviando…' : 'Enviar interesse'}
      carregando={enviando}
      onCancelar={onFechar}
      onConfirmar={enviar}
    >
      <div className="grade">
        <Campo rotulo="Nome completo" erro={erros.nome} className="c-12">
          {(p) => <input {...p} className="input" autoComplete="name" value={dados.nome} onChange={(e) => alterar({ nome: e.target.value })} />}
        </Campo>
        <Campo rotulo="E-mail" erro={erros.email} className="c-7">
          {(p) => <input {...p} type="email" className="input" autoComplete="email" value={dados.email} onChange={(e) => alterar({ email: e.target.value })} />}
        </Campo>
        <Campo rotulo="Telefone" erro={erros.telefone} className="c-5">
          {(p) => <input {...p} type="tel" className="input" autoComplete="tel" placeholder="(45) 99999-9999" value={dados.telefone} onChange={(e) => alterar({ telefone: mascaraTelefone(e.target.value) })} />}
        </Campo>
        <Campo rotulo="Mensagem" className="c-12">
          {(p) => <textarea {...p} rows={3} className="input input--area" placeholder="Gostaria de saber as condições de parcelamento…" value={dados.mensagem} onChange={(e) => alterar({ mensagem: e.target.value })} />}
        </Campo>
      </div>
      {erroEnvio && <div className="alerta alerta--erro" role="alert">{erroEnvio}</div>}
      <p className="nota-regra">A Urbizzi registra seu interesse e um corretor entra em contato. Nenhuma conta é criada.</p>
    </Dialogo>
  )
}
