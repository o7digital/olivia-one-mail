const ALLOWED_TAGS = new Set(['A', 'B', 'BLOCKQUOTE', 'BR', 'CODE', 'DIV', 'EM', 'FONT', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HR', 'I', 'IMG', 'LI', 'OL', 'P', 'PRE', 'SECTION', 'SPAN', 'STRONG', 'SUB', 'SUP', 'TABLE', 'TBODY', 'TD', 'TH', 'THEAD', 'TR', 'U', 'UL'])
const ALLOWED_STYLES = new Set(['color', 'font-family', 'font-size', 'font-style', 'font-weight', 'text-align', 'text-decoration'])
const DROPPED_TAGS = new Set(['HEAD', 'LINK', 'META', 'NOSCRIPT', 'SCRIPT', 'STYLE', 'TEMPLATE', 'TITLE'])

export function plainTextToHtml(value) {
  const container = document.createElement('div')
  container.textContent = value || ''
  return container.innerHTML.replace(/\n/g, '<br>')
}

export function sanitizeComposerHtml(value) {
  const parsedDocument = new DOMParser().parseFromString(value || '', 'text/html')
  const root = parsedDocument.createElement('div')
  root.innerHTML = parsedDocument.body.innerHTML

  for (const element of Array.from(root.querySelectorAll('*')).reverse()) {
    if (DROPPED_TAGS.has(element.tagName)) {
      element.remove()
      continue
    }
    if (!ALLOWED_TAGS.has(element.tagName)) {
      element.replaceWith(...element.childNodes)
      continue
    }

    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase()
      if (element.tagName === 'A' && name === 'href') {
        if (!/^(https?:|mailto:)/i.test(attribute.value)) element.removeAttribute(attribute.name)
      } else if (element.tagName === 'IMG' && name === 'src') {
        if (!/^(https?:|data:image\/|cid:)/i.test(attribute.value)) element.removeAttribute(attribute.name)
      } else if (name === 'contenteditable' && attribute.value.toLowerCase() === 'false') {
        continue
      } else if (name === 'data-forwarded-content' && attribute.value === 'true') {
        continue
      } else if (name === 'data-quoted-content' && attribute.value === 'true') {
        continue
      } else if (name.startsWith('aria-')) {
        continue
      } else if (name === 'class' && /^[a-zA-Z0-9_-]+(?:\s+[a-zA-Z0-9_-]+)*$/.test(attribute.value)) {
        continue
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
