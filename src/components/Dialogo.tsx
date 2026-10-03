import { useEffect, useRef, type ReactNode } from 'react'

interface DialogoProps {
  aberto: boolean
  titulo: string
  descricao?: ReactNode
  children?: ReactNode
  textoConfirmar: string
  textoCancelar?: string
  perigoso?: boolean
  carregando?: boolean
  confirmarDesabilitado?: boolean
  largo?: boolean
  semCancelar?: boolean
  onConfirmar: () => void
  onCancelar: () => void
}

/** Diálogo de confirmação baseado no <dialog> nativo (foco e Esc de graça). */
export function Dialogo({
  aberto,
  titulo,
  descricao,
  children,
  textoConfirmar,
  textoCancelar = 'Cancelar',
  perigoso,
  carregando,
  confirmarDesabilitado,
  largo,
  semCancelar,
  onConfirmar,
  onCancelar,
}: DialogoProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // jsdom não implementa showModal; cai para o atributo open.
    if (aberto && !el.open) {
      if (typeof el.showModal === 'function') el.showModal()
      else el.setAttribute('open', '')
    } else if (!aberto && el.open) {
      if (typeof el.close === 'function') el.close()
      else el.removeAttribute('open')
    }
  }, [aberto])

  return (
    <dialog
      ref={ref}
      className={`dialogo ${largo ? 'dialogo--largo' : ''}`}
      aria-labelledby="dialogo-titulo"
      onCancel={(e) => {
        e.preventDefault()
        if (!carregando) onCancelar()
      }}
      onClick={(e) => {
        if (e.target === ref.current && !carregando) onCancelar()
      }}
    >
      {aberto && (
        <form
          method="dialog"
          className="dialogo__corpo"
          onSubmit={(e) => {
            e.preventDefault()
            onConfirmar()
          }}
        >
          <h2 id="dialogo-titulo" className="dialogo__titulo">
            {titulo}
          </h2>
          {descricao && <div className="dialogo__descricao">{descricao}</div>}
          {children}
          <div className="dialogo__acoes">
            {!semCancelar && (
              <button type="button" className="btn btn--secundario" onClick={onCancelar} disabled={carregando}>
                {textoCancelar}
              </button>
            )}
            <button type="submit" className={`btn ${perigoso ? 'btn--perigo' : 'btn--primario'}`} disabled={carregando || confirmarDesabilitado}>
              {textoConfirmar}
            </button>
          </div>
        </form>
      )}
    </dialog>
  )
}
