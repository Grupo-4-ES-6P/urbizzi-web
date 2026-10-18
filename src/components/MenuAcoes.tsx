import { MoreHorizontal } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

export interface ItemMenu {
  rotulo: string
  icone?: ReactNode
  perigoso?: boolean
  onSelecionar: () => void
}

interface MenuAcoesProps {
  /** Nome acessível do botão, ex.: "Ações de Ana Souza". */
  rotulo: string
  itens: ItemMenu[]
}

const ALTURA_ESTIMADA = 160

/**
 * Menu "..." de ações de uma linha. Usa posição fixa para não ser cortado
 * pelo `overflow` da tabela; fecha com Esc, clique fora, rolagem ou ao escolher um item.
 */
export function MenuAcoes({ rotulo, itens }: Readonly<MenuAcoesProps>) {
  const [posicao, setPosicao] = useState<CSSProperties | null>(null)
  const botaoRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const aberto = posicao !== null

  const abrir = () => {
    const r = botaoRef.current?.getBoundingClientRect()
    if (!r) return
    const right = window.innerWidth - r.right
    // Perto do fim da tela, abre para cima.
    setPosicao(
      r.bottom + ALTURA_ESTIMADA > window.innerHeight ? { bottom: window.innerHeight - r.top + 4, right } : { top: r.bottom + 4, right },
    )
  }

  useEffect(() => {
    if (!aberto) return
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()
    const fechar = () => setPosicao(null)
    const fora = (e: MouseEvent) => {
      const alvo = e.target as Node
      if (!menuRef.current?.contains(alvo) && !botaoRef.current?.contains(alvo)) fechar()
    }
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      fechar()
      botaoRef.current?.focus()
    }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', tecla)
    window.addEventListener('scroll', fechar, true)
    window.addEventListener('resize', fechar)
    return () => {
      document.removeEventListener('mousedown', fora)
      document.removeEventListener('keydown', tecla)
      window.removeEventListener('scroll', fechar, true)
      window.removeEventListener('resize', fechar)
    }
  }, [aberto])

  if (itens.length === 0) return null

  return (
    <>
      <button
        ref={botaoRef}
        type="button"
        className="menu-acoes__botao"
        aria-label={rotulo}
        aria-haspopup="menu"
        aria-expanded={aberto}
        onClick={() => (aberto ? setPosicao(null) : abrir())}
      >
        <MoreHorizontal size={18} aria-hidden />
      </button>
      {aberto && (
        <div ref={menuRef} className="menu-acoes" role="menu" aria-label={rotulo} style={posicao}>
          {itens.map((item) => (
            <button
              key={item.rotulo}
              type="button"
              role="menuitem"
              className={item.perigoso ? 'menu-acoes__item--perigo' : undefined}
              onClick={() => {
                setPosicao(null)
                item.onSelecionar()
              }}
            >
              {item.icone}
              {item.rotulo}
            </button>
          ))}
        </div>
      )}
    </>
  )
}
