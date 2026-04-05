'use client'

import { create } from 'zustand'

interface PriceStore {
  prices: Record<string, number>
  setPrice: (symbol: string, price: number) => void
  ws: WebSocket | null
  connect: () => void
  disconnect: () => void
  subscribedSymbols: Set<string>
}

export const usePriceStore = create<PriceStore>((set, get) => ({
  prices: {},
  subscribedSymbols: new Set(),
  ws: null,

  setPrice: (symbol, price) =>
    set((state) => ({
      prices: { ...state.prices, [symbol]: price },
    })),

  connect: () => {
    const existingWs = get().ws
    if (existingWs && existingWs.readyState === WebSocket.OPEN) return

    const ws = new WebSocket('wss://stream.binance.com:9443/ws')

    ws.onopen = () => {
      console.log('[WS] Binance WebSocket connected')
      const symbols = get().subscribedSymbols
      if (symbols.size > 0) {
        ws.send(JSON.stringify({
          method: 'SUBSCRIBE',
          params: Array.from(symbols).map(s => `${s.toLowerCase()}@ticker`),
          id: 1,
        }))
      }
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.s && data.c) {
          const symbol = data.s
          const price = parseFloat(data.c)
          set((state) => ({
            prices: { ...state.prices, [symbol]: price },
          }))
        }
      } catch (e) {
        // ignore parse errors
      }
    }

    ws.onerror = (error) => {
      console.error('[WS] Error:', error)
    }

    ws.onclose = () => {
      console.log('[WS] Disconnected, reconnecting in 3s...')
      setTimeout(() => {
        if (get().ws === ws) {
          get().connect()
        }
      }, 3000)
    }

    set({ ws })
  },

  disconnect: () => {
    const ws = get().ws
    if (ws) {
      ws.close()
      set({ ws: null })
    }
  },
}))

// Subscribe to specific symbols
export function subscribeSymbols(symbols: string[]) {
  const store = usePriceStore.getState()
  const newSymbols = symbols.filter(s => !store.subscribedSymbols.has(s))

  if (newSymbols.length === 0) return

  const updated = new Set(store.subscribedSymbols)
  newSymbols.forEach(s => updated.add(s))

  usePriceStore.setState({ subscribedSymbols: updated })

  if (store.ws && store.ws.readyState === WebSocket.OPEN) {
    store.ws.send(JSON.stringify({
      method: 'SUBSCRIBE',
      params: newSymbols.map(s => `${s.toLowerCase()}@ticker`),
      id: Date.now(),
    }))
  }
}
