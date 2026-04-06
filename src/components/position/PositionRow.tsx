'use client'

import { useState, useEffect, useRef } from 'react'
import { PositionWithLive } from '@/types'
import { formatPrice, formatPnL, formatNumber, calculatePnL } from '@/lib/calculations'
import ADLIndicator from './ADLIndicator'

/* ── Tapbit exact icons — extracted from iui-icon font (iconfont.ttf) ── */
/* share = U+E61C, edit = U+E61B, viewBox based on upem=1024, Y-flipped via transform */
function TapbitShareIcon({ size = 14, color = 'currentColor', className = '' }: { size?: number; color?: string; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 1024 1024" fill={color} className={className}>
      <g transform="translate(40, 900) scale(1, -1)">
        <path d="M337 811H433Q450 811 462.5 798.5Q475 786 475.0 768.0Q475 750 462.5 737.5Q450 725 433 725H339Q278 725 258 724Q235 722 223 716Q199 703 186 679Q180 667 178 644Q177 624 177 563V205Q177 143 178 124Q180 101 186 89Q199 65 223 52Q235 46 258 44Q278 43 339 43H697Q759 43 778 44Q801 46 813 52Q838 65 850 89Q856 101 858 124Q859 144 859 205V299Q859 310 865.0 320.0Q871 330 881.0 335.5Q891 341 902.5 341.0Q914 341 923.5 335.5Q933 330 939.0 320.0Q945 310 945 299V203Q945 140 943 117Q940 77 926 51Q901 1 852 -24Q825 -37 785 -41Q762 -43 699 -43H337Q274 -43 251 -41Q211 -37 185 -24Q135 1 110 51Q97 77 93 117Q91 140 91 203V565Q91 628 93 651Q97 691 110 718Q135 767 185 792Q211 806 251 809Q274 811 337 811ZM744 798Q756 811 774.0 811.0Q792 811 804 798L932 670Q945 658 945.0 640.0Q945 622 932 610L804 482Q792 470 774.5 470.0Q757 470 744.5 482.5Q732 495 732.0 512.5Q732 530 744 542L799 597H766Q704 597 685 596Q661 594 650 588Q625 575 613 551Q607 539 605 516Q603 496 603 435V384Q603 366 590.5 353.5Q578 341 560.5 341.0Q543 341 530.5 353.5Q518 366 518 384V437Q518 500 520 523Q523 563 537 589Q562 639 611 664Q638 677 678 681Q701 683 764 683H799L744 738Q731 750 731.0 768.0Q731 786 744 798Z" />
      </g>
    </svg>
  )
}

function TapbitEditIcon({ size = 14, color = 'currentColor', className = '' }: { size?: number; color?: string; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 1024 1024" fill={color} className={className}>
      <g transform="translate(0, 900) scale(1, -1)">
        <path d="M765 819Q791 845 825.0 854.0Q859 863 893.5 854.0Q928 845 953.5 819.5Q979 794 988.0 759.5Q997 725 988.0 690.5Q979 656 954 631L543 221Q520 197 507 190Q490 179 470 174Q455 171 422 171H347Q330 171 317.5 183.5Q305 196 305 213V289Q305 321 308 336Q313 356 324 373Q332 386 355 409ZM893 759Q879 773 859.5 773.0Q840 773 826 759L418 351Q399 333 396.0 328.0Q393 323 391.5 317.0Q390 311 390 285V256H419Q445 256 451.0 257.5Q457 259 462.0 262.0Q467 265 485 283L893 691Q907 706 907.0 725.5Q907 745 893 759ZM294 768H475Q487 768 497.0 762.5Q507 757 512.5 747.0Q518 737 518.0 725.5Q518 714 512.5 704.0Q507 694 497.0 688.5Q487 683 475 683H296Q235 683 216 681Q192 679 181 673Q156 661 143 636Q138 625 136 601Q134 581 134 521V162Q134 101 136 82Q138 58 143 47Q156 22 181 9Q192 4 216 2Q235 0 296 0H655Q716 0 735 2Q759 4 770 9Q795 22 807 47Q813 58 815 82Q817 101 817 162V341Q817 353 822.5 363.0Q828 373 838.0 378.5Q848 384 859.5 384.0Q871 384 881.0 378.5Q891 373 896.5 363.0Q902 353 902 341V160Q902 98 900 75Q897 34 883 8Q858 -42 809 -67Q783 -80 742 -83Q719 -85 656 -85H294Q232 -85 209 -83Q168 -80 142 -67Q93 -42 67 8Q54 34 51 75Q49 98 49 160V522Q49 585 51 608Q54 649 67 675Q93 724 142 749Q168 763 209 766Q232 768 294 768Z" />
      </g>
    </svg>
  )
}

interface PositionRowProps {
  position: PositionWithLive
  isSelected: boolean
  onSelect: (p: PositionWithLive) => void
  onClose: (id: string, options?: number | { closeMargin?: number; closeQuantity?: number }) => void
  onEdit: (id: string, data: { takeProfit?: number | null; stopLoss?: number | null; leverage?: number }) => void
  onShare: (p: PositionWithLive) => void
  onTeledditToggle?: (p: PositionWithLive, checked: boolean) => void
}

function formatMarginMode(mode: string | undefined): string {
  if (!mode) return 'Cross'
  return mode.charAt(0).toUpperCase() + mode.slice(1).toLowerCase()
}

const ICON_COLOR = 'rgb(129, 134, 147)'

export default function PositionRow({ position: p, isSelected, onSelect, onClose, onEdit, onShare, onTeledditToggle }: PositionRowProps) {
  const [editingTPSL, setEditingTPSL] = useState(false)
  const [editTP, setEditTP] = useState('')
  const [editSL, setEditSL] = useState('')
  const [editingLev, setEditingLev] = useState(false)
  const [editLev, setEditLev] = useState('')
  const [teledditChecked, setTeledditChecked] = useState(false)
  const [closeQuantity, setCloseQuantity] = useState(() => {
    const defaultUsdt = p.quantity * (p.currentPrice || p.entryPrice)
    return String(Math.round(defaultUsdt * 100) / 100)
  })
  const [showPctPopup, setShowPctPopup] = useState(false)
  const pctPopupRef = useRef<HTMLDivElement>(null)

  // ESC to close % popup
  useEffect(() => {
    if (!showPctPopup) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowPctPopup(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [showPctPopup])

  // Click outside to close % popup
  useEffect(() => {
    if (!showPctPopup) return
    const handler = (e: MouseEvent) => {
      if (pctPopupRef.current && !pctPopupRef.current.contains(e.target as Node)) {
        setShowPctPopup(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showPctPopup])

  const price = p.currentPrice
  const pnlData = calculatePnL(p.side, p.entryPrice, price, p.leverage, p.amount, p.quantity, p.entryFee)
  const pnlColor = pnlData.pnl >= 0 ? 'text-binance-green' : 'text-binance-red'
  const sideColor = p.side === 'LONG' ? 'text-binance-green' : 'text-binance-red'
  const margin = p.amount / p.leverage
  const holding = p.quantity
  const base = p.symbol.replace('USDT', '')
  const positionValue = holding * price

  const startEdit = () => {
    setEditingTPSL(true)
    setEditTP(p.takeProfit?.toString() || '')
    setEditSL(p.stopLoss?.toString() || '')
  }

  const saveEdit = () => {
    onEdit(p.id, {
      takeProfit: editTP ? parseFloat(editTP) : null,
      stopLoss: editSL ? parseFloat(editSL) : null,
    })
    setEditingTPSL(false)
  }

  const startEditLev = () => {
    setEditingLev(true)
    setEditLev(String(p.leverage))
  }

  const saveLev = () => {
    const val = parseInt(editLev)
    if (val > 0 && val <= 125 && val !== p.leverage) {
      onEdit(p.id, { leverage: val })
    }
    setEditingLev(false)
  }

  const submitClose = () => {
    const usdtVal = parseFloat(closeQuantity)
    if (!usdtVal || usdtVal <= 0 || !price) return
    const coinQty = usdtVal / price
    if (coinQty < holding) {
      onClose(p.id, { closeQuantity: coinQty })
    } else {
      onClose(p.id)
    }
  }

  return (
    <tr
      onClick={() => onSelect(p)}
      className={`border-b border-binance-border/50 hover:bg-binance-border/20 cursor-pointer transition-colors ${
        isSelected ? 'bg-binance-yellow/5' : ''
      }`}
    >
      {/* Pair — ExternalLink icon like Tapbit */}
      <td className="pl-3 pr-2" style={{ height: 57 }}>
        <div
          className="flex flex-col justify-center"
          style={{ borderLeft: `4px solid ${p.side === 'LONG' ? 'rgb(0, 191, 117)' : 'rgb(234, 57, 67)'}`, paddingLeft: 8, height: 56 }}
        >
          <div className="flex items-center gap-1" style={{ lineHeight: '14px' }}>
            <span className="font-bold cursor-pointer text-binance-text">{base}USDT</span>
            <span className="font-bold" style={{ color: ICON_COLOR }}>Perp</span>
          </div>
          <div className="flex items-center gap-1" style={{ marginTop: 2, lineHeight: '14px' }} onClick={e => e.stopPropagation()}>
            {editingLev ? (
              <div className="flex items-center gap-1">
                <input
                  type="number" min="1" max="125" step="1"
                  value={editLev}
                  onChange={e => setEditLev(e.target.value.replace(/[^0-9]/g, ''))}
                  onKeyDown={e => { if (e.key === 'Enter') saveLev(); if (e.key === 'Escape') setEditingLev(false) }}
                  autoFocus
                  className="w-12 bg-binance-bg border border-binance-yellow/50 rounded px-1 py-0.5 text-center font-bold"
                  style={{ fontSize: 12, color: p.side === 'LONG' ? 'rgb(0, 191, 117)' : 'rgb(234, 57, 67)' }}
                />
                <span className="font-bold" style={{ fontSize: 12, color: p.side === 'LONG' ? 'rgb(0, 191, 117)' : 'rgb(234, 57, 67)' }}>X</span>
                <button onClick={saveLev} className="text-binance-yellow hover:underline" style={{ fontSize: 10 }}>OK</button>
                <label className="flex items-center gap-0.5 select-none cursor-pointer" style={{ fontSize: 10, color: ICON_COLOR, marginLeft: 2 }}>
                  <input
                    type="checkbox"
                    checked={teledditChecked}
                    onChange={e => {
                      e.stopPropagation()
                      const next = e.target.checked
                      setTeledditChecked(next)
                      onTeledditToggle?.(p, next)
                    }}
                    onClick={e => e.stopPropagation()}
                    className="accent-binance-yellow"
                    style={{ width: 12, height: 12 }}
                  />
                  <span>TD</span>
                </label>
              </div>
            ) : (
              <>
                <span className={`font-bold ${sideColor}`}>{p.leverage}X</span>
                <span onClick={startEditLev}>
                  <TapbitEditIcon
                    size={12}
                    color={ICON_COLOR}
                    className="cursor-pointer hover:opacity-70 transition-opacity"
                  />
                </span>
              </>
            )}
          </div>
        </div>
      </td>

      {/* Available/Holding */}
      <td className="py-2 px-2 text-binance-text">
        {formatPrice(positionValue)}/{formatPrice(positionValue)} USDT
      </td>

      {/* Entry Price */}
      <td className="py-2 px-2 text-binance-text">{formatPrice(p.entryPrice)}</td>

      {/* Margin */}
      <td className="py-1 px-2">
        <div className="flex flex-col text-binance-text" style={{ lineHeight: '13px' }}>
          <span>{formatNumber(margin)}</span>
          <span>{formatMarginMode(p.marginMode)}</span>
        </div>
      </td>

      {/* Mark Price */}
      <td className="py-2 px-2 text-binance-text">{formatPrice(price)}</td>

      {/* Unrealized PNL (ROE) — no underline, ExternalLink share icon */}
      <td className="py-1 px-2">
        <div className="flex items-center">
          <div className="flex flex-col" style={{ lineHeight: '14px' }}>
            <span className={pnlColor} style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{formatPnL(pnlData.pnl)}</span>
            <span className={pnlColor} style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>({formatNumber(pnlData.roe)}%)</span>
          </div>
          <span
            className="cursor-pointer hover:opacity-70 transition-opacity shrink-0 ml-2"
            onClick={e => { e.stopPropagation(); onShare(p) }}
          >
            <TapbitShareIcon size={14} color={ICON_COLOR} />
          </span>
        </div>
      </td>

      {/* Realized PNL */}
      <td className="py-1.5 px-2">
        <span className="text-binance-red" style={{ borderBottom: '1px dashed rgb(129, 134, 147)', paddingBottom: 1 }}>-{formatNumber(p.entryFee || 0)}</span>
      </td>

      {/* Liq. Price */}
      <td className="py-2 px-2" style={{ color: '#FFBB00' }}>
        {formatPrice(pnlData.liquidationPrice)}
      </td>

      {/* Market — Flash Close: 전체 시장가 종료 (슬리피지 적용) */}
      <td className="py-1.5 px-2" onClick={e => e.stopPropagation()}>
        <button
          onClick={() => onClose(p.id)}
          className="rounded hover:opacity-80 transition-colors"
          style={{ padding: '8px 12px', height: 32, backgroundColor: '#2C2D31', color: 'rgb(200, 200, 200)', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap' }}
        >
          Flash Close
        </button>
      </td>

      {/* Operation — 종료 가격 + 종료 규모 (USDT) */}
      <td className="py-1.5 px-2 relative" onClick={e => e.stopPropagation()}>
        <div className="flex flex-col gap-1">
          {/* 1번째 줄: 종료 가격 (readOnly, 실시간 마크프라이스) */}
          <input
            type="text"
            readOnly
            value={price ? formatPrice(price) : ''}
            placeholder="Market"
            className="bg-transparent border border-binance-border rounded-sm text-center text-binance-text w-full"
            style={{ height: 28, fontSize: 12 }}
          />
          {/* 2번째 줄: 종료 규모 USDT 입력 + %팝업 + Close */}
          <div className="flex items-center gap-1">
            <div className="relative flex-1">
              <input
                type="number"
                step="any"
                min="0"
                value={closeQuantity}
                onChange={e => setCloseQuantity(e.target.value)}
                onFocus={() => setShowPctPopup(true)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { submitClose(); setShowPctPopup(false) }
                  if (e.key === 'Escape') setShowPctPopup(false)
                }}
                className="bg-transparent border border-binance-border rounded-sm text-center text-binance-text w-full"
                style={{ height: 28, fontSize: 12 }}
                placeholder="USDT"
              />
              {showPctPopup && (
                <div
                  ref={pctPopupRef}
                  className="absolute left-full top-0 z-50 ml-1 bg-binance-card border border-binance-border rounded p-2"
                  style={{ minWidth: 160 }}
                  onClick={e => e.stopPropagation()}
                >
                  <div className="grid grid-cols-3 gap-1">
                    {[10, 25, 33, 50, 75, 100].map(pct => (
                      <button
                        key={pct}
                        onClick={() => {
                          const usdtVal = holding * price * (pct / 100)
                          setCloseQuantity(String(Math.round(usdtVal * 100) / 100))
                          setShowPctPopup(false)
                        }}
                        className="rounded text-center font-medium transition-colors hover:opacity-80"
                        style={{
                          padding: '6px 0',
                          fontSize: 12,
                          backgroundColor: pct === 100 ? 'rgb(234, 57, 67)' : '#2C2D31',
                          color: '#fff',
                        }}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => { submitClose(); setShowPctPopup(false) }}
              className="rounded transition-colors hover:opacity-80 shrink-0"
              style={{ padding: '6px 14px', backgroundColor: '#2C2D31', color: '#fff', fontSize: 12, fontWeight: 500 }}
            >
              Close
            </button>
          </div>
        </div>
      </td>

      {/* TP/SL */}
      <td className="py-2 px-2" onClick={e => e.stopPropagation()}>
        {editingTPSL ? (
          <div className="flex flex-col gap-0.5 items-center">
            <input type="number" step="any" value={editTP} onChange={e => setEditTP(e.target.value)} placeholder="TP"
              className="w-20 bg-binance-bg border border-binance-green/30 rounded px-1 py-0.5 text-binance-green text-center" style={{ fontSize: 12 }} />
            <input type="number" step="any" value={editSL} onChange={e => setEditSL(e.target.value)} placeholder="SL"
              className="w-20 bg-binance-bg border border-binance-red/30 rounded px-1 py-0.5 text-binance-red text-center" style={{ fontSize: 12 }} />
            <button onClick={saveEdit} className="text-binance-yellow hover:underline" style={{ fontSize: 12 }}>Confirm</button>
          </div>
        ) : (
          <span className="cursor-pointer" style={{ color: ICON_COLOR }} onClick={startEdit}>Add</span>
        )}
      </td>

      {/* Position TP/SL */}
      <td className="py-1.5 px-2">
        <div className="flex items-center">
          <div className="flex flex-col" style={{ lineHeight: '16px', marginRight: 8 }}>
            <span className="text-binance-green">{p.takeProfit ? formatPrice(p.takeProfit) : '--'}</span>
            <span className="text-binance-red">{p.stopLoss ? formatPrice(p.stopLoss) : '--'}</span>
          </div>
          <span
            className="cursor-pointer hover:opacity-70 transition-opacity"
            onClick={e => { e.stopPropagation(); startEdit() }}
          >
            <TapbitEditIcon size={14} color={ICON_COLOR} />
          </span>
        </div>
      </td>

      {/* ADL */}
      <td className="py-1.5 px-2">
        <ADLIndicator roe={pnlData.roe} />
      </td>
    </tr>
  )
}
