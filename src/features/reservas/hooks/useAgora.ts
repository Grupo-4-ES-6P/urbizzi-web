import { useEffect, useState } from 'react';

/** Instante atual, atualizado periodicamente para manter contagens regressivas em dia. */
export function useAgora(intervaloMs = 60_000): Date {
  const [agora, setAgora] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setAgora(new Date()), intervaloMs);
    return () => window.clearInterval(timer);
  }, [intervaloMs]);

  return agora;
}
