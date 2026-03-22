import { useContrast } from '../hooks/useContrast'

export default function HighContrastToggle(): JSX.Element {
  const [isHighContrast, toggle] = useContrast()

  return (
    <button
      onClick={toggle}
      aria-label={isHighContrast ? 'Switch to normal contrast' : 'Switch to high contrast'}
      title={isHighContrast ? 'High contrast: on' : 'High contrast: off'}
      className="flex items-center justify-center px-4 border-l border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className={`w-5 h-5 ${isHighContrast ? 'text-primary' : ''}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3v18" />
        <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none" />
      </svg>
    </button>
  )
}
