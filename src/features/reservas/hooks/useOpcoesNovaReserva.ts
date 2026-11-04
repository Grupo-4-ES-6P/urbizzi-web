import { useEffect, useState } from 'react';
import { listarClientes } from '../../../api/clientes/clientes';
import type { Cliente } from '../../../types/Cliente';
import { listarImoveis, listarLoteamentos } from '../../imoveis/api/imoveisApi';
import type { Imovel, Loteamento, SituacaoImovel } from '../../imoveis/types';
import { listarCorretores, type Corretor } from '../../usuarios/api/corretoresApi';
import { listarSituacaoImoveis } from '../api/reservasApi';

export interface OpcoesNovaReserva {
  loteamentos: Loteamento[];
  imoveis: Imovel[];
  situacoes: Record<number, SituacaoImovel>;
  /** Somente clientes ativos do módulo Clientes. */
  clientes: Cliente[];
  corretores: Corretor[];
}

export function useOpcoesNovaReserva(): OpcoesNovaReserva | null {
  const [opcoes, setOpcoes] = useState<OpcoesNovaReserva | null>(null);

  useEffect(() => {
    let ativo = true;
    Promise.all([listarLoteamentos(), listarImoveis(), listarSituacaoImoveis(), listarClientes(), listarCorretores()]).then(
      ([loteamentos, imoveis, situacoes, clientes, corretores]) => {
        if (!ativo) return;
        setOpcoes({
          loteamentos,
          imoveis,
          situacoes,
          clientes: clientes.filter((cliente) => cliente.ativo),
          corretores,
        });
      },
    );
    return () => {
      ativo = false;
    };
  }, []);

  return opcoes;
}
