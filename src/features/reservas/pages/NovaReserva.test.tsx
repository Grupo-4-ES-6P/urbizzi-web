import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '../../../context/ThemeContext';
import { criarReserva, listarReservas } from '../api/reservasApi';
import { AGORA_TESTE, criarClienteTeste, novaReservaInput } from '../test/fixtures';
import { NovaReserva } from './NovaReserva';

function renderNovaReserva() {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={['/reservas/nova']}>
        <Routes>
          <Route path="/reservas/nova" element={<NovaReserva />} />
          <Route path="/reservas" element={<p>Lista de reservas</p>} />
          <Route path="/reservas/:id" element={<p>Página de detalhe</p>} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('NovaReserva', () => {
  let clienteId: number;

  beforeEach(async () => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(AGORA_TESTE);
    clienteId = (await criarClienteTeste()).id_cliente;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calcula a data de expiração a partir da data inicial e da validade', async () => {
    const user = userEvent.setup();
    renderNovaReserva();

    const expiraEm = screen.getByLabelText('Expira em');
    expect(screen.getByLabelText('Data inicial')).toHaveValue('2026-08-26');
    expect(expiraEm).toHaveValue('10/09/2026');

    const validade = screen.getByLabelText('Validade (dias)');
    await user.clear(validade);
    await user.type(validade, '30');
    expect(expiraEm).toHaveValue('25/09/2026');
  });

  it('preenche CPF/CNPJ e telefone a partir do cliente cadastrado', async () => {
    const user = userEvent.setup();
    renderNovaReserva();

    await user.selectOptions(await screen.findByLabelText('Cliente'), 'Marina Ferreira Duarte');
    expect(screen.getByLabelText('CPF / CNPJ')).toHaveValue('048.912.330-27');
    expect(screen.getByLabelText('Telefone')).toHaveValue('(45) 99812-4477');
  });

  it('impede reservar um imóvel que já tem reserva ativa', async () => {
    await criarReserva(novaReservaInput({ cliente_id: clienteId, imovel_id: 103 }));
    const user = userEvent.setup();
    renderNovaReserva();

    await user.selectOptions(await screen.findByLabelText('Loteamento'), 'Universitário I');
    await user.selectOptions(screen.getByLabelText('Quadra / Lote'), 'Qd. 04 — Lote 12 (Reservado)');

    expect(screen.getByLabelText('Situação atual')).toHaveValue('Reservado');
    expect(screen.getByText('Já existe uma reserva ativa para este imóvel.')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Cliente'), 'Marina Ferreira Duarte');
    await user.selectOptions(screen.getByLabelText('Responsável comercial'), 'Gustavo Marques');
    await user.click(screen.getByRole('button', { name: 'Criar reserva' }));

    expect(screen.queryByText('Página de detalhe')).not.toBeInTheDocument();
    expect(await listarReservas()).toHaveLength(1);
  });

  it('cria a reserva para um imóvel disponível', async () => {
    const user = userEvent.setup();
    renderNovaReserva();

    await user.selectOptions(await screen.findByLabelText('Loteamento'), 'Universitário I');
    await user.selectOptions(screen.getByLabelText('Quadra / Lote'), 'Qd. 04 — Lote 12');
    await user.selectOptions(screen.getByLabelText('Cliente'), 'Marina Ferreira Duarte');
    await user.selectOptions(screen.getByLabelText('Responsável comercial'), 'Gustavo Marques');
    await user.click(screen.getByRole('button', { name: 'Criar reserva' }));

    expect(await screen.findByText('Página de detalhe')).toBeInTheDocument();
    const [reserva] = await listarReservas();
    expect(reserva).toMatchObject({ imovel_id: 103, cliente_id: clienteId, data_expiracao: '2026-09-10' });
  });

  it('cancela sem confirmação quando nenhum campo foi preenchido', async () => {
    const user = userEvent.setup();
    renderNovaReserva();

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByText('Lista de reservas')).toBeInTheDocument();
  });

  it('pede confirmação antes de cancelar quando há campos preenchidos', async () => {
    const user = userEvent.setup();
    renderNovaReserva();

    await user.selectOptions(await screen.findByLabelText('Cliente'), 'Marina Ferreira Duarte');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    const dialog = screen.getByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Continuar editando' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Cliente')).toHaveValue(String(clienteId));

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Descartar' }));
    expect(screen.getByText('Lista de reservas')).toBeInTheDocument();
  });
});
