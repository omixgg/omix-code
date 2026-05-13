import assert from 'node:assert/strict'
import test from 'node:test'

import { extractGitHubRepoSlug } from './repoSlug.ts'

test('keeps owner/repo input as-is', () => {
  assert.equal(extractGitHubRepoSlug('omixgg/OmixCode'), 'omixgg/OmixCode')
})

test('extracts slug from https GitHub URLs', () => {
  assert.equal(
    extractGitHubRepoSlug('https://github.com/omixgg/OmixCode'),
    'omixgg/OmixCode',
  )
  assert.equal(
    extractGitHubRepoSlug('https://www.github.com/omixgg/OmixCode.git'),
    'omixgg/OmixCode',
  )
})

test('extracts slug from ssh GitHub URLs', () => {
  assert.equal(
    extractGitHubRepoSlug('git@github.com:omixgg/OmixCode.git'),
    'omixgg/OmixCode',
  )
  assert.equal(
    extractGitHubRepoSlug('ssh://git@github.com/omixgg/OmixCode'),
    'omixgg/OmixCode',
  )
})

test('rejects malformed or non-GitHub URLs', () => {
  assert.equal(extractGitHubRepoSlug('https://gitlab.com/omixgg/OmixCode'), null)
  assert.equal(extractGitHubRepoSlug('https://github.com/omixgg'), null)
  assert.equal(extractGitHubRepoSlug('not actually github.com/omixgg/OmixCode'), null)
  assert.equal(
    extractGitHubRepoSlug('https://evil.example/?next=github.com/omixgg/OmixCode'),
    null,
  )
  assert.equal(
    extractGitHubRepoSlug('https://github.com.evil.example/omixgg/OmixCode'),
    null,
  )
  assert.equal(
    extractGitHubRepoSlug('https://example.com/github.com/omixgg/OmixCode'),
    null,
  )
})
