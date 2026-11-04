# Urbizzi Web

Scaffold técnico do frontend web da Urbizzi.

## Base configurada

- React 18 e React DOM
- TypeScript
- Vite
- React Router
- Lucide Icons
- ESLint
- Vitest e Testing Library
- Fontsource

## Instalação

```bash
npm install
```

## Rodando

```bash
npm run dev    # http://localhost:5173
npm test       # testes com Vitest
```

Acesso de demonstração: `admin@urbizzi.com.br` / `urbizzi123`.

## Telas

- **Login** — validação, "manter conectado", recuperação de senha.
- **Dashboard** — indicadores calculados, reservas com contagem regressiva, aprovação/recusa de propostas, busca global.
- **Imóveis** — listagem com filtros e paginação; cadastro/edição com busca de CEP (ViaCEP), marcação no mapa, upload de fotos, rascunhos e validação.
- **Clientes** — listagem com busca (nome, CPF/CNPJ, telefone, e-mail), ativação/desativação e exclusão em lote; cadastro/edição com validação de CPF/CNPJ, máscaras, busca de CEP e as reservas do cliente.
- **Reservas** — listagem com filtros por situação, alerta de vencimento e exportação CSV; nova reserva (RF13/RF14), renovação com limite do loteamento (RF15), cancelamento, expiração automática (RF16) e histórico de auditoria (RF32).

## Dados

Enquanto não há backend, os dados ficam no `localStorage` (`src/data/db.ts`), gerados por `src/data/seed.ts`.
Toda leitura/escrita assíncrona passa por `src/services/api.ts`: é ali que entram as chamadas HTTP quando a API existir.
O menu da conta (canto inferior da barra lateral) tem a opção de restaurar os dados de demonstração.
