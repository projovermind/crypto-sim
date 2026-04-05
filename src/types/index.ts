export interface Position {
  id: string
  userId: string
  symbol: string
  side: 'LONG' | 'SHORT'
  leverage: number
  entryPrice: number
  inputPrice?: number | null
  amount: number
  quantity: number
  marginMode: string  // "CROSS" or "ISOLATED"
  orderType: string
  entryFee: number
  takeProfit: number | null
  stopLoss: number | null
  status: 'OPEN' | 'CLOSED_TP' | 'CLOSED_SL' | 'CLOSED_MANUAL'
  deletedAt: string | null
  closedAt: string | null
  closedPrice: number | null
  pnl: number | null
  entryTime: string
  createdAt: string
  updatedAt: string
}

export interface LivePrice {
  symbol: string
  price: number
  priceChange: number
  priceChangePercent: number
  high24h: number
  low24h: number
  volume24h: number
}

export interface PositionWithLive extends Position {
  currentPrice: number
  pnlLive: number
  roeLive: number
  liquidationPrice: number
  hitTP: boolean
  hitSL: boolean
}

export interface Kline {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export type TimeInterval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w'

export const SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
  'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'DOTUSDT', 'MATICUSDT',
  'LINKUSDT', 'ATOMUSDT', 'UNIUSDT', 'LTCUSDT', 'NEARUSDT',
  'AAVEUSDT', 'FILUSDT', 'APTUSDT', 'ARBUSDT', 'OPUSDT',
  'SUIUSDT', 'SEIUSDT', 'TIAUSDT', 'INJUSDT', 'STXUSDT',
  'IMXUSDT', 'RUNEUSDT', 'PEPEUSDT', 'WIFUSDT', 'FETUSDT',
] as const

export const LEVERAGES = [1, 2, 3, 5, 10, 15, 20, 25, 30, 50, 75, 100, 125] as const

export const SYMBOL_ICONS: Record<string, string> = {
  BTC: '₿', ETH: 'Ξ', BNB: '◆', SOL: '◎', XRP: '✕',
  ADA: '₳', DOGE: 'Ð', AVAX: '▲', DOT: '●', MATIC: '⬡',
}

export function getSymbolBase(symbol: string): string {
  return symbol.replace('USDT', '')
}
