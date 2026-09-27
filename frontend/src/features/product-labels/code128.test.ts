import { describe, expect, it } from 'vitest'

import {
  Code128EncodingError,
  buildCode128Barcode,
  encodeCode128,
} from './code128'

describe('encodeCode128', () => {
  it('codifica ABC con el vector Code 128 B conocido', () => {
    expect(encodeCode128('ABC')).toEqual([104, 33, 34, 35, 1, 106])
  })

  it('inicia en C para una secuencia numérica par cuando acorta el símbolo', () => {
    expect(encodeCode128('123456')).toEqual([105, 12, 34, 56, 44, 106])
  })

  it('cambia entre B y C y conserva una corrida numérica impar', () => {
    const symbols = encodeCode128('A12345Z')

    expect(symbols.slice(0, -2)).toEqual([104, 33, 17, 99, 23, 45, 100, 58])
    expect(symbols.at(-1)).toBe(106)
  })

  it('produce siempre la misma secuencia y checksum', () => {
    const first = encodeCode128('FIL-00125')

    expect(encodeCode128('FIL-00125')).toEqual(first)
    expect(first.at(-2)).toBe(
      (first[0]! +
        first.slice(1, -2).reduce((sum, value, index) => {
          return sum + value * (index + 1)
        }, 0)) %
        103,
    )
  })

  it('rechaza el primer carácter no representable sin transliterarlo', () => {
    expect(() => encodeCode128('REP-Ñ')).toThrowError(Code128EncodingError)
    try {
      encodeCode128('REP-Ñ')
    } catch (error) {
      expect(error).toMatchObject({ index: 4, character: 'Ñ' })
    }
  })
})

describe('buildCode128Barcode', () => {
  it('incluye zonas silenciosas, barras enteras y un nombre accesible', () => {
    const barcode = buildCode128Barcode('ABC')

    expect(barcode.quietZoneModules).toBe(10)
    expect(barcode.widthModules).toBe(88)
    expect(barcode.heightModules).toBe(40)
    expect(barcode.ariaLabel).toBe('Código de barras de ABC')
    expect(barcode.bars.length).toBeGreaterThan(0)
    expect(
      barcode.bars.every(({ x, width }) => Number.isInteger(x) && width > 0),
    ).toBe(true)
    expect(Math.min(...barcode.bars.map(({ x }) => x))).toBe(10)
    expect(
      Math.max(...barcode.bars.map(({ x, width }) => x + width)),
    ).toBeLessThanOrEqual(barcode.widthModules - 10)
  })

  it('la tabla produce once módulos por símbolo y trece para la parada', () => {
    const barcode = buildCode128Barcode('ABC')
    const symbolWidthWithoutQuietZones = barcode.widthModules - 20

    expect(symbolWidthWithoutQuietZones).toBe(5 * 11 + 13)
  })
})
