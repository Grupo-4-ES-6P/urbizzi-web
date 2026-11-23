// Node 26 tem localStorage próprio e ele tampa o do jsdom
const janela = (globalThis as { jsdom?: { window: Window } }).jsdom?.window
if (janela) {
  for (const nome of ['localStorage', 'sessionStorage'] as const) {
    Object.defineProperty(globalThis, nome, { configurable: true, value: janela[nome] })
  }
}
