import '@testing-library/jest-dom/vitest'
import { configure } from '@testing-library/react'

import { restaurarDemo } from '../data/db'
import { fetchFalso, reiniciarApiFalsa } from './apiFalsa'

// Com a suíte rodando em paralelo, digitação simulada + render passam de 1 s
// em máquinas lentas; o padrão do findBy* (1 s) gerava falhas intermitentes.
configure({ asyncUtilTimeout: 5000 })

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  restaurarDemo()
  reiniciarApiFalsa()
  vi.stubGlobal('fetch', vi.fn(fetchFalso))
})

afterEach(() => {
  vi.unstubAllGlobals()
})
