import { useId, type ReactNode } from 'react'

import type { Urgencia } from '../lib/format'

interface CampoProps {
  rotulo: string
  erro?: string
  dica?: string
  className?: string
  children: (props: { id: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }) => ReactNode
}

/** Rótulo + controle + mensagem de erro, com os atributos de acessibilidade ligados. */
export function Campo({ rotulo, erro, dica, className = '', children }: Readonly<CampoProps>) {
  const id = useId()
  const idMensagem = `${id}-msg`
  const mensagem = erro ?? dica
  return (
    <div className={`campo ${erro ? 'campo--erro' : ''} ${className}`}>
      <label htmlFor={id} className="campo__rotulo">
        {rotulo}
      </label>
      {children({
        id,
        'aria-invalid': erro ? true : undefined,
        'aria-describedby': mensagem ? idMensagem : undefined,
      })}
      {mensagem && (
        <span id={idMensagem} className={erro ? 'campo__erro' : 'campo__dica'}>
          {mensagem}
        </span>
      )}
    </div>
  )
}

interface ToggleProps {
  rotulo: string
  ativo: boolean
  onChange: (ativo: boolean) => void
  desabilitado?: boolean
}

export function Toggle({ rotulo, ativo, onChange, desabilitado }: Readonly<ToggleProps>) {
  return (
    <label className={`toggle ${desabilitado ? 'toggle--desabilitado' : ''}`}>
      <span>{rotulo}</span>
      <button
        type="button"
        role="switch"
        aria-checked={ativo}
        aria-label={rotulo}
        disabled={desabilitado}
        className="toggle__trilho"
        onClick={() => onChange(!ativo)}
      >
        <span className="toggle__bola" />
      </button>
    </label>
  )
}

const ROTULOS_URGENCIA: Record<Urgencia, string> = {
  critico: 'Crítico',
  atencao: 'Atenção',
  normal: 'Normal',
}

export function BadgeUrgencia({ urgencia }: Readonly<{ urgencia: Urgencia }>) {
  return <span className={`badge badge--${urgencia}`}>{ROTULOS_URGENCIA[urgencia]}</span>
}

export function Badge({ variante, children }: Readonly<{ variante: string; children: ReactNode }>) {
  return <span className={`badge badge--${variante}`}>{children}</span>
}

export function Spinner({ tamanho = 16 }: Readonly<{ tamanho?: number }>) {
  return <span className="spinner" style={{ width: tamanho, height: tamanho }} aria-hidden />
}
