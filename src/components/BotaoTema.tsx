import { Moon, Sun } from 'lucide-react'

import { useTema } from '../contexts/TemaContext'

/** Alterna entre tema claro e escuro. `sobreEscuro` para fundos sempre escuros (topo do site). */
export function BotaoTema({ sobreEscuro = false, className = '' }: { sobreEscuro?: boolean; className?: string }) {
  const { tema, alternarTema } = useTema()
  const escuro = tema === 'escuro'
  const rotulo = escuro ? 'Usar tema claro' : 'Usar tema escuro'
  return (
    <button
      type="button"
      className={`botao-tema ${sobreEscuro ? 'botao-tema--escuro' : ''} ${className}`}
      onClick={alternarTema}
      aria-label={rotulo}
      title={rotulo}
    >
      {escuro ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )
}
