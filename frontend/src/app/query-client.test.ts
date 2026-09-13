import { expect, it } from 'vitest'
import { ProblemError } from '@/shared/api/client'
import { createAppQueryClient } from './query-client'

it.each(['query', 'mutation'] as const)(
  'refreshes a revoked session after a rejected %s',
  async (kind) => {
    const client = createAppQueryClient()
    client.setQueryData(['session'], { authenticated: true })
    const reject = async () => {
      throw new ProblemError('Sesión requerida', 403, 'not_authenticated')
    }
    if (kind === 'query') {
      await expect(
        client.fetchQuery({ queryKey: ['users'], queryFn: reject }),
      ).rejects.toThrow()
    } else {
      await expect(
        client
          .getMutationCache()
          .build(client, { mutationFn: reject })
          .execute(undefined),
      ).rejects.toThrow()
    }
    expect(client.getQueryState(['session'])?.isInvalidated).toBe(true)
    client.clear()
  },
)

it('does not invalidate a session for a validation error', async () => {
  const client = createAppQueryClient()
  client.setQueryData(['session'], { authenticated: true })
  await expect(
    client
      .getMutationCache()
      .build(client, {
        mutationFn: async () => {
          throw new ProblemError('Campo inválido', 400, 'invalid')
        },
      })
      .execute(undefined),
  ).rejects.toThrow()
  expect(client.getQueryState(['session'])?.isInvalidated).toBe(false)
  client.clear()
})
