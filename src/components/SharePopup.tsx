'use client'

import { useState, useRef, useCallback } from 'react'
import { PositionWithLive } from '@/types'
import ProfitCard, { PROFIT_CARD_BACKGROUNDS } from '@/components/ProfitCard'

interface SharePopupProps {
  position: PositionWithLive
  onClose: () => void
}

export default function SharePopup({ position, onClose }: SharePopupProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [bgIndex, setBgIndex] = useState(0)
  const [copyImageDone, setCopyImageDone] = useState(false)
  const [copyNoLogoDone, setCopyNoLogoDone] = useState(false)
  const [hideProfit, setHideProfit] = useState(false)

  const symbol = position.symbol

  const handleCopyImage = useCallback(async () => {
    if (!cardRef.current) return
    try {
      await document.fonts.ready
      const { toPng } = await import('html-to-image')
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2,
        cacheBust: true,
      })
      const res = await fetch(dataUrl)
      const blob = await res.blob()
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ])
        setCopyImageDone(true)
        setTimeout(() => setCopyImageDone(false), 2000)
      } catch {
        const link = document.createElement('a')
        link.download = `${symbol}_share_${Date.now()}.png`
        link.href = dataUrl
        link.click()
      }
    } catch (e) {
      console.error('Copy image failed:', e)
    }
  }, [symbol])

  const handleCopyImageNoLogo = useCallback(async () => {
    if (!cardRef.current) return
    try {
      await document.fonts.ready
      const { toPng } = await import('html-to-image')
      const pixelRatio = 2
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio,
        cacheBust: true,
      })

      // Load image, crop top 120px (CSS pixels), write to clipboard
      const img = new window.Image()
      img.src = dataUrl
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = reject
      })

      const cropTop = 60 * pixelRatio  // 120 real pixels — removes header (logo + Perpetual) only
      const canvasW = img.naturalWidth
      const canvasH = img.naturalHeight - cropTop

      const canvas = document.createElement('canvas')
      canvas.width = canvasW
      canvas.height = canvasH
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, cropTop, canvasW, canvasH, 0, 0, canvasW, canvasH)

      const croppedBlob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
      if (!croppedBlob) throw new Error('Canvas toBlob failed')

      try {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': croppedBlob })
        ])
        setCopyNoLogoDone(true)
        setTimeout(() => setCopyNoLogoDone(false), 2000)
      } catch {
        const link = document.createElement('a')
        link.download = `${symbol}_share_nologo_${Date.now()}.png`
        link.href = canvas.toDataURL('image/png')
        link.click()
      }
    } catch (e) {
      console.error('Copy image (no logo) failed:', e)
    }
  }, [symbol])

  const goNext = () => setBgIndex(i => (i + 1) % PROFIT_CARD_BACKGROUNDS.length)
  const goPrev = () => setBgIndex(i => (i - 1 + PROFIT_CARD_BACKGROUNDS.length) % PROFIT_CARD_BACKGROUNDS.length)

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal frame — Tapbit: bg #23262d, padding 29px, rounded 12px */}
      <div
        className="relative z-10"
        onClick={e => e.stopPropagation()}
        style={{ background: '#23262d', borderRadius: 12, padding: 29, width: 420 }}
      >
        {/* Close X */}
        <button
          onClick={onClose}
          className="absolute flex items-center justify-center"
          style={{ top: 16, right: 16, width: 24, height: 24, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Title */}
        <div style={{ lineHeight: '24px', fontSize: 20, marginBottom: 16, color: '#fff' }}>
          Share with Friends
        </div>

        {/* Carousel container — relative for arrows */}
        <div className="relative" style={{ maxWidth: 362, margin: '0 auto' }}>

          {/* Left arrow */}
          <button
            onClick={goPrev}
            className="absolute flex items-center justify-center"
            style={{
              top: '50%', left: -16, transform: 'translateY(-50%)',
              width: 30, height: 44, borderRadius: 6, cursor: 'pointer',
              border: '1px solid hsla(0,0%,100%,.08)',
              background: '#33363d',
              zIndex: 10,
              boxShadow: '-1px -1px 8px 0 rgba(2,5,13,.2)',
            }}
          >
            <svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6,1 1,6 6,11" />
            </svg>
          </button>

          {/* Right arrow */}
          <button
            onClick={goNext}
            className="absolute flex items-center justify-center"
            style={{
              top: '50%', right: -16, transform: 'translateY(-50%)',
              width: 30, height: 44, borderRadius: 6, cursor: 'pointer',
              border: '1px solid hsla(0,0%,100%,.08)',
              background: '#33363d',
              zIndex: 10,
              boxShadow: '-1px -1px 8px 0 rgba(2,5,13,.2)',
            }}
          >
            <svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1,1 6,6 1,11" />
            </svg>
          </button>

          {/* Poster card */}
          <ProfitCard
            ref={cardRef}
            position={position}
            bgIndex={bgIndex}
            hideProfit={hideProfit}
          />

          {/* Carousel dots */}
          <div
            className="flex items-center justify-center mx-auto"
            style={{
              marginTop: 12, padding: '4px 13px', height: 14, borderRadius: 7,
              border: '1px solid hsla(0,0%,100%,.1)', background: '#23262d',
              width: 'fit-content', gap: 4,
            }}
          >
            {PROFIT_CARD_BACKGROUNDS.map((bg, i) => (
              <button
                key={bg.id}
                onClick={() => setBgIndex(i)}
                style={{
                  width: bgIndex === i ? 20 : 8, height: 4, borderRadius: 2,
                  background: bgIndex === i ? '#fff' : 'hsla(0,0%,100%,.2)',
                  border: 'none', padding: 0, cursor: 'pointer', transition: 'all 0.2s',
                }}
              />
            ))}
          </div>
        </div>

        {/* Hide profit checkbox */}
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            id="hideProfit"
            checked={hideProfit}
            onChange={e => setHideProfit(e.target.checked)}
          />
          <label htmlFor="hideProfit" style={{ color: '#fff', fontSize: 14, cursor: 'pointer' }}>
            수익금 숨기기
          </label>
        </div>

        {/* Copy Image buttons */}
        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={handleCopyImage}
            style={{
              width: '100%', height: 44, lineHeight: '24px', fontSize: 16,
              textAlign: 'center', border: 'none', borderRadius: 6,
              backgroundColor: '#303238', color: '#fff', cursor: 'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#FFBB00'; e.currentTarget.style.color = '#000' }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#303238'; e.currentTarget.style.color = '#fff' }}
          >
            {copyImageDone ? '✅ Copied!' : 'Copy Image'}
          </button>
          <button
            onClick={handleCopyImageNoLogo}
            style={{
              width: '100%', height: 44, lineHeight: '24px', fontSize: 16,
              textAlign: 'center', border: 'none', borderRadius: 6,
              backgroundColor: '#303238', color: '#fff', cursor: 'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#FFBB00'; e.currentTarget.style.color = '#000' }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#303238'; e.currentTarget.style.color = '#fff' }}
          >
            {copyNoLogoDone ? '✅ Copied!' : 'Copy Image (No Logo)'}
          </button>
        </div>
      </div>
    </div>
  )
}
