export function IconButton({ children, className = '', label, ...props }) {
  return (
    <button className={`icon ${className}`} aria-label={label} title={label} type="button" {...props}>
      {children}
    </button>
  )
}
