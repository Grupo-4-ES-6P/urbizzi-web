import { Lock } from 'lucide-react'
import { useState } from 'react'

import { Dialogo } from '../../components/Dialogo'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useDb } from '../../data/db'
import type { MatrizPermissoes as Matriz, Perfil, Permissao } from '../../data/types'
import { celulaTravada, diferencasMatriz, PERFIS, PERMISSOES, rotuloPermissao } from '../../lib/permissoes'
import { salvarPermissoes } from '../../services/usuarios'
import { dataHora } from '../propostas/proposta'

/**
 * Matriz editável: as alterações ficam num rascunho até o Administrador salvar
 * e confirmar. Ao salvar, valem na hora para todos os usuários do perfil.
 */
export function MatrizPermissoes() {
  const db = useDb()
  const { usuario } = useAuth()
  const notificar = useToast()
  const [rascunho, setRascunho] = useState<Matriz | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [salvando, setSalvando] = useState(false)

  const matriz = rascunho ?? db.permissoes
  const mudancas = diferencasMatriz(db.permissoes, matriz)
  const ultima = db.alteracoesPermissoes.at(-1)

  const alternar = (permissao: Permissao, perfil: Perfil) => {
    const atuais = matriz[permissao] ?? []
    const novos = atuais.includes(perfil) ? atuais.filter((p) => p !== perfil) : [...atuais, perfil]
    setRascunho({ ...matriz, [permissao]: novos })
  }

  const salvar = async () => {
    setSalvando(true)
    try {
      const salvas = await salvarPermissoes(matriz, usuario?.id ?? '')
      notificar(`Permissões salvas: ${salvas.length} ${salvas.length === 1 ? 'alteração' : 'alterações'}.`)
      setRascunho(null)
    } catch (e) {
      notificar(e instanceof Error ? e.message : 'Não foi possível salvar as permissões.', 'erro')
    } finally {
      setSalvando(false)
      setConfirmando(false)
    }
  }

  return (
    <section className="card" aria-labelledby="matriz-titulo">
      <div className="card__cabecalho">
        <div>
          <h2 id="matriz-titulo" className="card__titulo">
            Matriz de permissões
          </h2>
          <p className="card__subtitulo">
            Define o que cada perfil pode executar no sistema
            {ultima && ` · última alteração em ${dataHora(ultima.data)} por ${ultima.autor}`}
          </p>
        </div>
        {mudancas.length > 0 && (
          <div className="matriz__acoes">
            <button type="button" className="btn btn--secundario btn--pequeno" onClick={() => setRascunho(null)} disabled={salvando}>
              Descartar
            </button>
            <button type="button" className="btn btn--primario btn--pequeno" onClick={() => setConfirmando(true)} disabled={salvando}>
              Salvar permissões ({mudancas.length})
            </button>
          </div>
        )}
      </div>
      <div className="tabela-wrap">
        <table className="tabela matriz">
          <thead>
            <tr>
              <th>Permissão</th>
              {PERFIS.map((p) => (
                <th key={p.perfil} className="matriz__perfil" title={p.perfil}>
                  {p.sigla}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSOES.map((regra) => (
              <tr key={regra.permissao}>
                <td className="matriz__permissao">{regra.rotulo}</td>
                {PERFIS.map(({ perfil }) => {
                  const travada = celulaTravada(regra.permissao, perfil)
                  const alterada = mudancas.some((m) => m.permissao === regra.permissao && m.perfil === perfil)
                  return (
                    <td key={perfil} className={`matriz__perfil ${alterada ? 'matriz__perfil--alterada' : ''}`}>
                      <span className="matriz__celula">
                        <input
                          type="checkbox"
                          className="matriz__marca"
                          aria-label={`${perfil}: ${regra.rotulo}`}
                          checked={(matriz[regra.permissao] ?? []).includes(perfil)}
                          disabled={travada || salvando}
                          title={
                            travada ? 'Sempre permitido ao Administrador, para ninguém perder o acesso à gestão de usuários' : undefined
                          }
                          onChange={() => alternar(regra.permissao, perfil)}
                        />
                        {travada && <Lock size={11} className="matriz__cadeado" aria-hidden />}
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialogo
        aberto={confirmando}
        titulo="Salvar a matriz de permissões?"
        descricao="As permissões valem na hora para todos os usuários de cada perfil, inclusive quem já está conectado."
        textoConfirmar={salvando ? 'Salvando…' : 'Salvar permissões'}
        carregando={salvando}
        largo
        onCancelar={() => setConfirmando(false)}
        onConfirmar={salvar}
      >
        <ul className="matriz__resumo">
          {mudancas.map((m) => (
            <li key={`${m.permissao}-${m.perfil}`}>
              <strong className={m.concedida ? 'matriz__concede' : 'matriz__remove'}>{m.concedida ? 'Concede' : 'Remove'}</strong>{' '}
              {m.perfil}: {rotuloPermissao(m.permissao)}
            </li>
          ))}
        </ul>
      </Dialogo>
    </section>
  )
}
