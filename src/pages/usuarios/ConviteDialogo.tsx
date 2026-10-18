import { useState } from 'react'

import { Dialogo } from '../../components/Dialogo'
import { Campo } from '../../components/ui'
import { useToast } from '../../contexts/ToastContext'
import { PERFIS } from '../../lib/permissoes'
import { conviteVazio, ehPerfil, validarConvite, type FormConvite } from '../../lib/usuarios'
import { convidarUsuario } from '../../services/usuarios'

interface ConviteDialogoProps {
  aberto: boolean
  executorId: string
  emailsExistentes: string[]
  onFechar: () => void
}

export function ConviteDialogo({ aberto, executorId, emailsExistentes, onFechar }: Readonly<ConviteDialogoProps>) {
  const notificar = useToast()
  const [form, setForm] = useState<FormConvite>(conviteVazio)
  const [tentou, setTentou] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const erros = tentou ? validarConvite(form, emailsExistentes) : {}

  const alterar = (parcial: Partial<FormConvite>) => setForm((atual) => ({ ...atual, ...parcial }))

  const fechar = () => {
    setForm(conviteVazio())
    setTentou(false)
    onFechar()
  }

  const enviar = async () => {
    setTentou(true)
    if (Object.keys(validarConvite(form, emailsExistentes)).length > 0) return
    setEnviando(true)
    try {
      const criado = await convidarUsuario(form, executorId)
      notificar(`Convite enviado para ${criado.email}.`)
      fechar()
    } catch (e) {
      notificar(e instanceof Error ? e.message : 'Não foi possível enviar o convite.', 'erro')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialogo
      aberto={aberto}
      titulo="Convidar usuário"
      descricao="O convidado recebe um link por e-mail para definir a senha. Até lá, não consegue entrar."
      textoConfirmar={enviando ? 'Enviando…' : 'Enviar convite'}
      carregando={enviando}
      onCancelar={fechar}
      onConfirmar={enviar}
    >
      <div className="dialogo__campos">
        <Campo rotulo="Nome completo" erro={erros.nome}>
          {(p) => (
            <input {...p} className="input" autoComplete="off" value={form.nome} onChange={(e) => alterar({ nome: e.target.value })} />
          )}
        </Campo>
        <Campo rotulo="E-mail" erro={erros.email}>
          {(p) => (
            <input
              {...p}
              type="email"
              className="input"
              autoComplete="off"
              placeholder="seunome@urbizzi.com.br"
              value={form.email}
              onChange={(e) => alterar({ email: e.target.value })}
            />
          )}
        </Campo>
        <Campo rotulo="Perfil" erro={erros.papel}>
          {(p) => (
            <select
              {...p}
              className="input select"
              value={form.papel}
              onChange={(e) => alterar({ papel: ehPerfil(e.target.value) ? e.target.value : '' })}
            >
              <option value="">Selecione</option>
              {PERFIS.map((perfil) => (
                <option key={perfil.perfil} value={perfil.perfil}>
                  {perfil.perfil} — {perfil.descricao.toLowerCase()}
                </option>
              ))}
            </select>
          )}
        </Campo>
      </div>
    </Dialogo>
  )
}
