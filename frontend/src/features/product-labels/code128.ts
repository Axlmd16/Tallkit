export class Code128EncodingError extends Error {
  constructor(
    readonly index: number,
    readonly character: string,
  ) {
    super(`Carácter no representable en la posición ${index + 1}.`)
    this.name = 'Code128EncodingError'
  }
}

export interface Code128Bar {
  x: number
  width: number
}

export interface Code128Barcode {
  symbols: number[]
  bars: Code128Bar[]
  widthModules: number
  heightModules: number
  quietZoneModules: number
  ariaLabel: string
}

const CODE_128_PATTERNS = [
  '212222',
  '222122',
  '222221',
  '121223',
  '121322',
  '131222',
  '122213',
  '122312',
  '132212',
  '221213',
  '221312',
  '231212',
  '112232',
  '122132',
  '122231',
  '113222',
  '123122',
  '123221',
  '223211',
  '221132',
  '221231',
  '213212',
  '223112',
  '312131',
  '311222',
  '321122',
  '321221',
  '312212',
  '322112',
  '322211',
  '212123',
  '212321',
  '232121',
  '111323',
  '131123',
  '131321',
  '112313',
  '132113',
  '132311',
  '211313',
  '231113',
  '231311',
  '112133',
  '112331',
  '132131',
  '113123',
  '113321',
  '133121',
  '313121',
  '211331',
  '231131',
  '213113',
  '213311',
  '213131',
  '311123',
  '311321',
  '331121',
  '312113',
  '312311',
  '332111',
  '314111',
  '221411',
  '431111',
  '111224',
  '111422',
  '121124',
  '121421',
  '141122',
  '141221',
  '112214',
  '112412',
  '122114',
  '122411',
  '142112',
  '142211',
  '241211',
  '221114',
  '413111',
  '241112',
  '134111',
  '111242',
  '121142',
  '121241',
  '114212',
  '124112',
  '124211',
  '411212',
  '421112',
  '421211',
  '212141',
  '214121',
  '412121',
  '111143',
  '111341',
  '131141',
  '114113',
  '114311',
  '411113',
  '411311',
  '113141',
  '114131',
  '311141',
  '411131',
  '211412',
  '211214',
  '211232',
  '2331112',
] as const

const START_B = 104
const START_C = 105
const CODE_B = 100
const CODE_C = 99
const STOP = 106

function isDigitPair(value: string, index: number): boolean {
  return /^\d{2}$/.test(value.slice(index, index + 2))
}

function digitRunLength(value: string, index: number): number {
  let length = 0
  while (/^\d$/.test(value[index + length] ?? '')) length += 1
  return length
}

function encodeData(value: string): { start: number; data: number[] } {
  const inB = new Map<number, number[]>()
  const inC = new Map<number, number[]>()

  const bestInB = (index: number): number[] => {
    if (index >= value.length) return []
    const cached = inB.get(index)
    if (cached) return cached

    const direct = [value.charCodeAt(index) - 32, ...bestInB(index + 1)]
    const switched = isDigitPair(value, index)
      ? [CODE_C, Number(value.slice(index, index + 2)), ...bestInC(index + 2)]
      : undefined
    const preferSwitchOnTie = digitRunLength(value, index) % 2 === 0
    const result =
      switched !== undefined &&
      (switched.length < direct.length ||
        (switched.length === direct.length && preferSwitchOnTie))
        ? switched
        : direct
    inB.set(index, result)
    return result
  }

  const bestInC = (index: number): number[] => {
    if (index >= value.length) return []
    const cached = inC.get(index)
    if (cached) return cached

    const result = isDigitPair(value, index)
      ? [Number(value.slice(index, index + 2)), ...bestInC(index + 2)]
      : [CODE_B, value.charCodeAt(index) - 32, ...bestInB(index + 1)]
    inC.set(index, result)
    return result
  }

  const fromB = bestInB(0)
  if (!isDigitPair(value, 0)) return { start: START_B, data: fromB }

  const fromC = [Number(value.slice(0, 2)), ...bestInC(2)]
  return fromC.length < fromB.length
    ? { start: START_C, data: fromC }
    : { start: START_B, data: fromB }
}

function calculateChecksum(start: number, data: number[]): number {
  return (
    (start +
      data.reduce((sum, symbol, index) => sum + symbol * (index + 1), 0)) %
    103
  )
}

function buildBars(
  symbols: number[],
  quietZoneModules: number,
): {
  bars: Code128Bar[]
  widthModules: number
} {
  const bars: Code128Bar[] = []
  let x = quietZoneModules

  for (const symbol of symbols) {
    const pattern = CODE_128_PATTERNS[symbol]!
    for (const [index, digit] of [...pattern].entries()) {
      const width = Number(digit)
      if (index % 2 === 0) bars.push({ x, width })
      x += width
    }
  }

  return { bars, widthModules: x + quietZoneModules }
}

export function encodeCode128(value: string): number[] {
  for (const [index, character] of [...value].entries()) {
    const codePoint = character.codePointAt(0)!
    if (codePoint < 32 || codePoint > 126) {
      throw new Code128EncodingError(index, character)
    }
  }

  const { start, data } = encodeData(value)
  const checksum = calculateChecksum(start, data)
  return [start, ...data, checksum, STOP]
}

export function buildCode128Barcode(value: string): Code128Barcode {
  const symbols = encodeCode128(value)
  const quietZoneModules = 10
  const { bars, widthModules } = buildBars(symbols, quietZoneModules)

  return {
    symbols,
    bars,
    widthModules,
    heightModules: 40,
    quietZoneModules,
    ariaLabel: `Código de barras de ${value}`,
  }
}
