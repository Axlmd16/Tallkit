import type { ProformaIssue } from './types'

/** Antepone la línea afectada a un impedimento del servidor. */
export function issueText(issue: ProformaIssue): string {
  const match = /^lines\.(\d+)\./.exec(issue.field)
  return match
    ? `Línea ${Number(match[1]) + 1}: ${issue.message}`
    : issue.message
}
