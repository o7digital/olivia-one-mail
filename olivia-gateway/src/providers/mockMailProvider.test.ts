import test from 'node:test'
import assert from 'node:assert/strict'
import { MockMailProvider } from './mockMailProvider.js'

test('setMessageLabels assigns, trims/dedupes, and persists labels on a message', async () => {
  const provider = new MockMailProvider()

  const result = await provider.setMessageLabels('partnership-proposal', [' Clients ', 'VIP', 'Clients'])
  assert.deepEqual(result, { id: 'partnership-proposal', labels: ['Clients', 'VIP'] })

  const message = await provider.getMessage('partnership-proposal')
  assert.deepEqual(message?.labels, ['Clients', 'VIP'])
})

test('listLabels returns the sorted union of labels assigned within a folder', async () => {
  const provider = new MockMailProvider()

  await provider.setMessageLabels('partnership-proposal', ['Partnerships'])
  await provider.setMessageLabels('q3-review', ['Clients', 'Partnerships'])

  const labels = await provider.listLabels('Inbox')
  assert.deepEqual(labels, ['Clients', 'Partnerships'])
})

test('setMessageLabels can clear all labels from a message', async () => {
  const provider = new MockMailProvider()

  await provider.setMessageLabels('campaign-concepts', ['Draft label'])
  const cleared = await provider.setMessageLabels('campaign-concepts', [])
  assert.deepEqual(cleared, { id: 'campaign-concepts', labels: [] })
})
