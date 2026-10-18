export function formatStorageBytes(value) {
  if (!value) return '0 B'
  const unit = Math.min(3, Math.max(0, Math.floor(Math.log(value) / Math.log(1024))))
  return `${(value / 1024 ** unit).toFixed(unit ? 1 : 0)} ${['B', 'KB', 'MB', 'GB'][unit]}`
}
