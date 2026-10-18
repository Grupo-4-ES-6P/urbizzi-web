import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../../../context/ThemeContext';
import { criarReserva } from '../api/reservasApi';
import { AGORA_TESTE, criarClienteTeste, novaReservaInput } from '../test/fixtures';
import { ListaReservas } from './ListaReservas';

function renderLista() {
  return render(
    <ThemeProvider>
      <MemoryRouter>
        <ListaReservas />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

function linhasDaTabela() {
  return within(screen.getByRole('table')).getAllByRole('row').slice(1);
}

describe('ListaReservas', () => {
  beforeEach(async () => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(AGORA_TESTE);

    const cliente = await criarClienteTeste();
    // Ativa com folga, crítica (vence hoje) e expirada (data retroativa).
    await criarReserva(novaReservaInput({ cliente_id: cliente.id_cliente, imovel_id: 202, validade_dias: 5 }));
    await criarReserva(novaReservaInput({ cliente_id: cliente.id_cliente, imovel_id: 103, data_inicio: '2026-08-16', validade_dias: 10 }));
    await criarReserva(novaReservaInput({ cliente_id: cliente.id_cliente, imovel_id: 301, data_inicio: '2026-08-01', validade_dias: 5, responsavel_id: 3 }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('mostra contadores por situação e o alerta de vencimento', async () => {
    renderLista();

    expect(await screen.findByRole('button', { name: 'Todas 3' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Ativas 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'A vencer 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expiradas 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Convertidas 0' })).toBeInTheDocument();
    expect(screen.getByText('1 reserva vence nas próximas 48 horas')).toBeInTheDocument();
    expect(linhasDaTabela()).toHaveLength(3);
  });

  it('ordena ativas pelo vencimento e destaca o tempo crítico', async () => {
    renderLista();
    await screen.findByRole('button', { name: 'Todas 3' });

    const [primeira, segunda, terceira] = linhasDaTabela();
    expect(primeira).toHaveTextContent('Lote 12 — Qd. 04 · Universitário I');
    expect(primeira).toHaveTextContent('4h 19min');
    expect(primeira).toHaveTextContent('Crítico');
    expect(segunda).toHaveTextContent('Ativa');
    expect(terceira).toHaveTextContent('Expirada');
  });

  it('filtra pela aba selecionada', async () => {
    const user = userEvent.setup();
    renderLista();

    await user.click(await screen.findByRole('button', { name: 'Expiradas 1' }));
    expect(linhasDaTabela()).toHaveLength(1);
    expect(linhasDaTabela()[0]).toHaveTextContent('Lote 27 — Biopark Toledo');

    await user.click(screen.getByRole('button', { name: 'Convertidas 0' }));
    expect(screen.getByText('Nenhuma reserva nesta situação.')).toBeInTheDocument();
  });

  it('"Ver reservas críticas" aplica o filtro A vencer', async () => {
    const user = userEvent.setup();
    renderLista();

    await user.click(await screen.findByRole('button', { name: 'Ver reservas críticas' }));
    expect(screen.getByRole('button', { name: 'A vencer 1' })).toHaveAttribute('aria-pressed', 'true');
    expect(linhasDaTabela()).toHaveLength(1);
    expect(linhasDaTabela()[0]).toHaveTextContent('Crítico');
  });

  it('busca por corretor, imóvel ou cliente ignorando acentos e maiúsculas', async () => {
    const user = userEvent.setup();
    renderLista();
    const busca = await screen.findByRole('searchbox', { name: 'Buscar reservas' });

    await user.type(busca, 'kruger');
    expect(screen.getByRole('button', { name: 'Todas 1' })).toBeInTheDocument();
    expect(linhasDaTabela()).toHaveLength(1);
    expect(linhasDaTabela()[0]).toHaveTextContent('Lote 27 — Biopark Toledo');

    await user.clear(busca);
    await user.type(busca, 'UNIVERSITARIO');
    expect(linhasDaTabela()).toHaveLength(1);
    expect(linhasDaTabela()[0]).toHaveTextContent('Lote 12 — Qd. 04 · Universitário I');

    await user.clear(busca);
    await user.type(busca, 'marina');
    expect(linhasDaTabela()).toHaveLength(3);

    await user.clear(busca);
    await user.type(busca, 'inexistente');
    expect(screen.getByText('Nenhuma reserva encontrada para "inexistente".')).toBeInTheDocument();
    expect(screen.getByText('1 reserva vence nas próximas 48 horas')).toBeInTheDocument();
  });
});
