const ALLOWED_TAGS = new Set(['A', 'B', 'BLOCKQUOTE', 'BR', 'DIV', 'EM', 'FONT', 'I', 'LI', 'OL', 'P', 'SPAN', 'STRONG', 'U', 'UL'])
const ALLOWED_STYLES = new Set(['color', 'font-family', 'font-size', 'font-style', 'font-weight', 'text-align', 'text-decoration'])

export function plainTextToHtml(value) {
  const container = document.createElement('div')
  container.textContent = value || ''
  return container.innerHTML.replace(/\n/g, '<br>')
}

export function sanitizeComposerHtml(value) {
  const documentFragment = new DOMParser().parseFromString(`<div>${value || ''}</div>`, 'text/html')
  const root = documentFragment.body.firstElementChild
  if (!root) return ''

  for (const element of Array.from(root.querySelectorAll('*')).reverse()) {
    if (!ALLOWED_TAGS.has(element.tagName)) {
      element.replaceWith(...element.childNodes)
      continue
    }

    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase()
      if (element.tagName === 'A' && name === 'href') {
        if (!/^(https?:|mailto:)/i.test(attribute.value)) element.removeAttribute(attribute.name)
      } else if (element.tagName === 'FONT' && ['color', 'face', 'size'].includes(name)) {
        continue
      } else if (name === 'style') {
        for (const property of Array.from(element.style)) {
          if (!ALLOWED_STYLES.has(property)) element.style.removeProperty(property)
        }
        if (!element.getAttribute('style')) element.removeAttribute('style')
      } else {
        element.removeAttribute(attribute.name)
      }
    }
  }

  return root.innerHTML
}
