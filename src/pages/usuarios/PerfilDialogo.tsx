import { useState } from 'react'

import { Dialogo } from '../../components/Dialogo'
import { Campo } from '../../components/ui'
import { useToast } from '../../contexts/ToastContext'
import type { Perfil, Usuario } from '../../data/types'
import { PERFIS } from '../../lib/permissoes'
import { ehPerfil } from '../../lib/usuarios'
import { alterarPerfil } from '../../services/usuarios'

interface PerfilDialogoProps {
  /** Usuário em edição; `null` mantém o diálogo fechado. */
  usuario: Usuario | null
  executorId: string
  onFechar: () => void
}

export function PerfilDialogo({ usuario, executorId, onFechar }: Readonly<PerfilDialogoProps>) {
  const notificar = useToast()
  const [escolhido, setEscolhido] = useState<Perfil | null>(null)
  const [salvando, setSalvando] = useState(false)
  const perfil = escolhido ?? usuario?.papel ?? 'Corretor'

  const fechar = () => {
    setEscolhido(null)
    onFechar()
  }

  const salvar = async () => {
    if (!usuario) return
    if (perfil === usuario.papel) return fechar()
    setSalvando(true)
    try {
      await alterarPerfil(usuario.id, perfil, executorId)
      notificar(`${usuario.nome} agora é ${perfil}.`)
      fechar()
    } catch (e) {
      notificar(e instanceof Error ? e.message : 'Não foi possível alterar o perfil.', 'erro')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialogo
      aberto={usuario !== null}
      titulo={`Alterar perfil de ${usuario?.nome ?? ''}`}
      descricao="As permissões do novo perfil valem imediatamente, inclusive para uma sessão já aberta."
      textoConfirmar={salvando ? 'Salvando…' : 'Salvar perfil'}
      carregando={salvando}
      onCancelar={fechar}
      onConfirmar={salvar}
    >
      <div className="dialogo__campos">
        <Campo rotulo="Perfil">
          {(p) => (
            <select
              {...p}
              className="input select"
              value={perfil}
              onChange={(e) => ehPerfil(e.target.value) && setEscolhido(e.target.value)}
            >
              {PERFIS.map((opcao) => (
                <option key={opcao.perfil} value={opcao.perfil}>
                  {opcao.perfil} — {opcao.descricao.toLowerCase()}
                </option>
              ))}
            </select>
          )}
        </Campo>
      </div>
    </Dialogo>
  )
}
