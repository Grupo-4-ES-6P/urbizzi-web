interface LogoProps {
  comSlogan?: boolean
  tamanho?: 'sm' | 'lg'
}

export function Logo({ comSlogan = false, tamanho = 'sm' }: Readonly<LogoProps>) {
  return (
    <span className={`logo logo--${tamanho}`}>
      <svg className="logo__icone" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="3" fill="var(--laranja)" />
        <path d="M7 9h18L11 23h14" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="bevel" />
      </svg>
      <span className="logo__texto">
        <span className="logo__nome">urbizzi</span>
        {comSlogan && <span className="logo__slogan">Desenvolvimento urbano</span>}
      </span>
    </span>
  )
}
