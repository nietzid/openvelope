import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Skeleton } from './Skeleton'

describe('Skeleton', () => {
  it('renders with aria-hidden for accessibility', () => {
    const html = renderToStaticMarkup(createElement(Skeleton))
    expect(html).toContain('aria-hidden="true"')
  })

  it('applies width and height as inline styles', () => {
    const html = renderToStaticMarkup(
      createElement(Skeleton, { width: '200px', height: '16px' })
    )
    expect(html).toContain('width:200px')
    expect(html).toContain('height:16px')
  })

  it('accepts numeric width and height', () => {
    const html = renderToStaticMarkup(
      createElement(Skeleton, { width: 100, height: 20 })
    )
    expect(html).toContain('width:100px')
    expect(html).toContain('height:20px')
  })

  it('applies custom className', () => {
    const html = renderToStaticMarkup(
      createElement(Skeleton, { className: 'my-custom-class' })
    )
    expect(html).toContain('my-custom-class')
  })

  it('includes pulse animation keyframes', () => {
    const html = renderToStaticMarkup(createElement(Skeleton))
    expect(html).toContain('@keyframes skeleton-pulse')
    expect(html).toContain('opacity: 0.4')
    expect(html).toContain('opacity: 0.7')
  })

  it('applies 1.5s pulse animation via inline style', () => {
    const html = renderToStaticMarkup(createElement(Skeleton))
    expect(html).toContain('skeleton-pulse 1.5s ease-in-out infinite')
  })

  it('uses bg-surface class for theme-aware background', () => {
    const html = renderToStaticMarkup(createElement(Skeleton))
    expect(html).toContain('bg-surface')
  })
})
