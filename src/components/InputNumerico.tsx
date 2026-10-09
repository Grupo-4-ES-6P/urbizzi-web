import { formatarDecimal } from '../lib/format'

interface InputNumericoProps {
  id?: string
  valor: number | null
  onChange: (valor: number | null) => void
  prefixo?: string
  sufixo?: string
  placeholder?: string
  'aria-label'?: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}

/**
 * Campo numérico com máscara pt-BR de duas casas: os dígitos entram pela
 * direita (como em caixas eletrônicos), então "45500000" vira "455.000,00".
 */
export function InputNumerico({ valor, onChange, prefixo, sufixo, placeholder = '0,00', ...resto }: Readonly<InputNumericoProps>) {
  return (
    <div className="input-adorno">
      {prefixo && <span className="input-adorno__texto">{prefixo}</span>}
      <input
        {...resto}
        className="input"
        inputMode="numeric"
        placeholder={placeholder}
        value={valor === null ? '' : formatarDecimal(valor)}
        onChange={(e) => {
          const digitos = e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 13)
          onChange(digitos ? Number(digitos) / 100 : null)
        }}
      />
      {sufixo && <span className="input-adorno__texto">{sufixo}</span>}
    </div>
  )
}
