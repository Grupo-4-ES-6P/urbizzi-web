import { useCallback, useEffect, useMemo, useState } from 'react';
import { listarClientes } from '../../../api/clientes/clientes';
import type { Cliente } from '../../../types/Cliente';
import { listarImoveis, listarLoteamentos } from '../../imoveis/api/imoveisApi';
import type { Imovel, Loteamento } from '../../imoveis/types';
import { listarCorretores, type Corretor } from '../../usuarios/api/corretoresApi';
import { buscarReserva, listarReservas } from '../api/reservasApi';
import type { Reserva, SituacaoReserva } from '../types';
import { rotuloImovel } from '../utils/formatacao';
import { classificarReserva, msRestantes } from '../utils/prazo';
import { useAgora } from './useAgora';

export interface ReservaView {
  reserva: Reserva;
  situacao: SituacaoReserva;
  msRestantes: number;
  imovel: Imovel | undefined;
  loteamento: Loteamento | undefined;
  imovelLabel: string;
  cliente: Cliente | undefined;
  clienteNome: string;
  responsavelNome: string;
}

interface Catalogo {
  imoveis: Map<number, Imovel>;
  loteamentos: Map<number, Loteamento>;
  clientes: Map<number, Cliente>;
  corretores: Map<number, Corretor>;
}

async function carregarCatalogo(): Promise<Catalogo> {
  const [imoveis, loteamentos, clientes, corretores] = await Promise.all([
    listarImoveis(),
    listarLoteamentos(),
    listarClientes(),
    listarCorretores(),
  ]);

  return {
    imoveis: new Map(imoveis.map((imovel) => [imovel.id, imovel])),
    loteamentos: new Map(loteamentos.map((loteamento) => [loteamento.id, loteamento])),
    clientes: new Map(clientes.map((cliente) => [cliente.id_cliente, cliente])),
    corretores: new Map(corretores.map((corretor) => [corretor.id, corretor])),
  };
}

function montarView(reserva: Reserva, catalogo: Catalogo, agora: Date): ReservaView {
  const imovel = catalogo.imoveis.get(reserva.imovel_id);
  const loteamento = imovel ? catalogo.loteamentos.get(imovel.loteamento_id) : undefined;
  const cliente = catalogo.clientes.get(reserva.cliente_id);

  return {
    reserva,
    situacao: classificarReserva(reserva, agora),
    msRestantes: msRestantes(reserva.data_expiracao, agora),
    imovel,
    loteamento,
    imovelLabel: rotuloImovel(imovel, loteamento),
    cliente,
    clienteNome: cliente?.nome_completo ?? 'Cliente removido',
    responsavelNome: catalogo.corretores.get(reserva.responsavel_id)?.nome ?? '—',
  };
}

export function useReservas() {
  const agora = useAgora();
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);

  const recarregar = useCallback(async () => {
    const [dados, cat] = await Promise.all([listarReservas(), carregarCatalogo()]);
    setReservas(dados);
    setCatalogo(cat);
  }, []);

  useEffect(() => {
    let ativo = true;
    Promise.all([listarReservas(), carregarCatalogo()]).then(([dados, cat]) => {
      if (!ativo) return;
      setReservas(dados);
      setCatalogo(cat);
    });
    return () => {
      ativo = false;
    };
  }, []);

  const views = useMemo(
    () => (catalogo ? reservas.map((reserva) => montarView(reserva, catalogo, agora)) : []),
    [reservas, catalogo, agora],
  );

  return { views, isLoading: catalogo === null, recarregar };
}

export function useReserva(id: string) {
  const agora = useAgora();
  const [reserva, setReserva] = useState<Reserva | undefined>();
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);

  const recarregar = useCallback(async () => {
    const [dados, cat] = await Promise.all([buscarReserva(id), carregarCatalogo()]);
    setReserva(dados);
    setCatalogo(cat);
  }, [id]);

  useEffect(() => {
    let ativo = true;
    Promise.all([buscarReserva(id), carregarCatalogo()]).then(([dados, cat]) => {
      if (!ativo) return;
      setReserva(dados);
      setCatalogo(cat);
    });
    return () => {
      ativo = false;
    };
  }, [id]);

  const view = useMemo(
    () => (catalogo && reserva ? montarView(reserva, catalogo, agora) : undefined),
    [reserva, catalogo, agora],
  );

  return { view, isLoading: catalogo === null, recarregar };
}
