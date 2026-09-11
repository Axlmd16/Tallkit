import { useQuery } from '@tanstack/react-query'

import { getHealth } from '@/shared/api/health'
import { environment } from '@/shared/config/env'
import {
  Button,
  InlineNotice,
  LoadingState,
  PageHeader,
  Surface,
} from '@/shared/ui'

export function TechnicalStatusPage() {
  const health = useQuery({
    queryKey: ['technical-health'],
    queryFn: () => getHealth(environment.apiBaseUrl),
    retry: false,
  })

  return (
    <section>
      <PageHeader
        description={`Disponibilidad de la base técnica de ${environment.appName}.`}
        title="Estado técnico"
      />
      <Surface className="mt-6 max-w-3xl">
        {health.isPending && (
          <LoadingState label="Comprobando backend y PostgreSQL…" />
        )}
        {health.isSuccess && (
          <InlineNotice title="Backend y PostgreSQL disponibles" tone="success">
            El sistema respondió correctamente a la comprobación técnica.
          </InlineNotice>
        )}
        {health.isError && (
          <InlineNotice
            title="Backend o PostgreSQL no disponible"
            tone="danger"
          >
            Compruebe los servicios antes de continuar con tareas operativas.
          </InlineNotice>
        )}
        <Button
          className="mt-5"
          pending={health.isFetching}
          pendingLabel="Comprobando…"
          onClick={() => void health.refetch()}
        >
          Comprobar nuevamente
        </Button>
      </Surface>
    </section>
  )
}
