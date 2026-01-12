import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FloatingSupportButton } from './FloatingSupportButton'

describe('FloatingSupportButton', () => {
  it('renders an anchor element with the correct href', () => {
    render(<FloatingSupportButton />)

    const link = screen.getByRole('link', { name: /buy me a coffee/i })
    expect(link).toHaveAttribute('href', 'https://buymeacoffee.com/delucca')
  })

  it('opens in a new tab with security attributes', () => {
    render(<FloatingSupportButton />)

    const link = screen.getByRole('link', { name: /buy me a coffee/i })
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('has an accessible aria-label', () => {
    render(<FloatingSupportButton />)

    const link = screen.getByRole('link', { name: /support this project/i })
    expect(link).toBeInTheDocument()
  })

  it('displays visible label text', () => {
    render(<FloatingSupportButton />)

    expect(screen.getByText('Buy me a coffee')).toBeInTheDocument()
  })

  it('displays the coffee emoji icon', () => {
    render(<FloatingSupportButton />)

    expect(screen.getByText('☕')).toBeInTheDocument()
  })
})

