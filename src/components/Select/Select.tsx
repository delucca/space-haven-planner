import { useState, useRef, useEffect, useCallback, useId } from 'react'
import styles from './Select.module.css'

export interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  options: SelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  'aria-label'?: string
}

export function Select({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  className,
  'aria-label': ariaLabel,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const listboxRef = useRef<HTMLUListElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listboxId = useId()
  const buttonId = useId()

  const selectedOption = options.find((opt) => opt.value === value)
  const selectedIndex = options.findIndex((opt) => opt.value === value)

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Focus listbox when dropdown opens
  useEffect(() => {
    if (isOpen && listboxRef.current) {
      listboxRef.current.focus()
    }
  }, [isOpen])

  // Scroll focused option into view
  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && listboxRef.current) {
      const focusedElement = listboxRef.current.children[focusedIndex] as HTMLElement
      focusedElement?.scrollIntoView({ block: 'nearest' })
    }
  }, [isOpen, focusedIndex])

  const openDropdown = useCallback(() => {
    setIsOpen(true)
    setFocusedIndex(selectedIndex >= 0 ? selectedIndex : 0)
  }, [selectedIndex])

  const closeDropdown = useCallback(() => {
    setIsOpen(false)
    setFocusedIndex(-1)
    buttonRef.current?.focus()
  }, [])

  const selectOption = useCallback(
    (optionValue: string) => {
      onChange(optionValue)
      closeDropdown()
    },
    [onChange, closeDropdown]
  )

  const handleButtonClick = () => {
    if (isOpen) {
      closeDropdown()
    } else {
      openDropdown()
    }
  }

  const handleButtonKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
      case ' ':
      case 'ArrowDown':
      case 'ArrowUp':
        e.preventDefault()
        if (!isOpen) {
          openDropdown()
        }
        break
      case 'Escape':
        if (isOpen) {
          e.preventDefault()
          closeDropdown()
        }
        break
    }
  }

  const handleListKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setFocusedIndex((prev) => Math.min(prev + 1, options.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setFocusedIndex((prev) => Math.max(prev - 1, 0))
        break
      case 'Home':
        e.preventDefault()
        setFocusedIndex(0)
        break
      case 'End':
        e.preventDefault()
        setFocusedIndex(options.length - 1)
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (focusedIndex >= 0) {
          selectOption(options[focusedIndex].value)
        }
        break
      case 'Escape':
        e.preventDefault()
        closeDropdown()
        break
      case 'Tab':
        closeDropdown()
        break
      default:
        // Type-ahead: find option starting with pressed key
        if (e.key.length === 1 && e.key.match(/[a-z0-9]/i)) {
          const char = e.key.toLowerCase()
          const startIndex = focusedIndex + 1
          const searchOptions = [
            ...options.slice(startIndex),
            ...options.slice(0, startIndex),
          ]
          const found = searchOptions.findIndex((opt) =>
            opt.label.toLowerCase().startsWith(char)
          )
          if (found >= 0) {
            const actualIndex = (startIndex + found) % options.length
            setFocusedIndex(actualIndex)
          }
        }
    }
  }

  const handleOptionClick = (optionValue: string) => {
    selectOption(optionValue)
  }

  const handleOptionMouseEnter = (index: number) => {
    setFocusedIndex(index)
  }

  return (
    <div ref={containerRef} className={`${styles.container} ${className ?? ''}`}>
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        className={styles.trigger}
        onClick={handleButtonClick}
        onKeyDown={handleButtonKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-label={ariaLabel}
      >
        <span className={styles.value}>
          {selectedOption?.label ?? placeholder}
        </span>
        <span className={styles.arrow} data-open={isOpen}>
          ▾
        </span>
      </button>

      {isOpen && (
        <ul
          ref={listboxRef}
          id={listboxId}
          role="listbox"
          className={styles.dropdown}
          tabIndex={-1}
          onKeyDown={handleListKeyDown}
          aria-activedescendant={
            focusedIndex >= 0 ? `${listboxId}-option-${focusedIndex}` : undefined
          }
          aria-labelledby={buttonId}
        >
          {options.map((option, index) => (
            <li
              key={option.value}
              id={`${listboxId}-option-${index}`}
              role="option"
              className={styles.option}
              data-focused={index === focusedIndex}
              data-selected={option.value === value}
              aria-selected={option.value === value}
              onClick={() => handleOptionClick(option.value)}
              onMouseEnter={() => handleOptionMouseEnter(index)}
            >
              {option.label}
              {option.value === value && (
                <span className={styles.checkmark}>✓</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

