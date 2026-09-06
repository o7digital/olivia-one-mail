import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveFromName, type MailcowConnectionConfig } from './mailcowAuth.js'

const config = {
  fromName: 'Olivia One',
  fromNameMap: {
    'contact@conchadepalacio.com': 'Concha de Palacio',
    'karen@kallistacafe.com': 'Karen Kallista',
    'contact@nodelifestyle.com': 'Node Lifestyle',
  },
} satisfies Pick<MailcowConnectionConfig, 'fromName' | 'fromNameMap'>

test('resolves a distinct sender name for each Mailcow mailbox', () => {
  assert.equal(resolveFromName('contact@conchadepalacio.com', config), 'Concha de Palacio')
  assert.equal(resolveFromName('KAREN@KALLISTACAFE.COM', config), 'Karen Kallista')
  assert.equal(resolveFromName('contact@nodelifestyle.com', config), 'Node Lifestyle')
})

test('falls back to the default sender name for an unmapped mailbox', () => {
  assert.equal(resolveFromName('other@example.com', config), 'Other')
})

test('derives a sender name from an unmapped client mailbox', () => {
  assert.equal(resolveFromName('karen@example.com', { fromName: 'Olivier Steineur', fromNameMap: {} }), 'Karen')
  assert.equal(resolveFromName('sales.team@example.com', { fromName: 'Olivier Steineur', fromNameMap: {} }), 'Sales Team')
})
