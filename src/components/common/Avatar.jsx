export function Avatar({ initials, tone = 'cyan', small = false }) {
  return (
    <span className={`avatar ${tone} ${small ? 'small' : ''}`} aria-hidden="true">
      {initials}
    </span>
  )
}
