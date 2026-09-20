import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

import { desktopWidth, setViewport } from './test-viewport'

// Las pruebas parten de escritorio (sidebar expandido); las del rail compacto
// reducen el viewport a una tableta.
setViewport(desktopWidth)

afterEach(() => setViewport(desktopWidth))
afterEach(cleanup)
