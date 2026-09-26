import '@testing-library/jest-dom/vitest'

import { restaurarDemo } from '../data/db'

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  restaurarDemo()
})
