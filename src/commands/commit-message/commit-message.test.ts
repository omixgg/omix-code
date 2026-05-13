import { describe, expect, it } from 'bun:test'
import {
  formatCoAuthorTrailer,
  parseCoAuthor,
  stripMatchingQuotes,
  USAGE,
} from './commit-message.js'

describe('commit-message command helpers', () => {
  it('parses quoted co-author names with a plain email', () => {
    expect(parseCoAuthor('"GPT 5.5" noreply@OmixCode.dev')).toEqual({
      name: 'GPT 5.5',
      email: 'noreply@OmixCode.dev',
    })
  })

  it('parses co-author trailers with angle-bracket emails', () => {
    expect(parseCoAuthor('OmixCode (gpt-5.5) <noreply@OmixCode.dev>')).toEqual(
      {
        name: 'OmixCode (gpt-5.5)',
        email: 'noreply@OmixCode.dev',
      },
    )
  })

  it('rejects co-author trailers with empty sanitized names', () => {
    expect(parseCoAuthor('"  " noreply@OmixCode.dev')).toBeNull()
    expect(parseCoAuthor('"  " <noreply@OmixCode.dev>')).toBeNull()
  })

  it('strips one pair of matching quotes from custom attribution text', () => {
    expect(stripMatchingQuotes('"Generated with OmixCode"')).toBe(
      'Generated with OmixCode',
    )
    expect(stripMatchingQuotes("'Generated with OmixCode'")).toBe(
      'Generated with OmixCode',
    )
    expect(stripMatchingQuotes('"Generated with OmixCode')).toBe(
      '"Generated with OmixCode',
    )
  })

  it('formats a sanitized co-author trailer', () => {
    expect(
      formatCoAuthorTrailer('OmixCode <gpt>\n', '<noreply@OmixCode.dev>'),
    ).toBe('Co-Authored-By: OmixCode gpt <noreply@OmixCode.dev>')
  })

  it('makes set scope explicit with example text', () => {
    expect(USAGE).toContain(
      'Controls only the attribution text appended after /commit messages.',
    )
    expect(USAGE).toContain(
      '/commit-message set "Generated with OmixCode using GPT-5.5"',
    )
    expect(USAGE).not.toContain('/commit-message set-attribution')
  })
})
