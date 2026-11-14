import {
  useBusinessName,
  type BusinessNameScope,
} from '@/shared/api/entity-logos'

/** Escribe el nombre del negocio (comercial o artesanal) en lugar de su RUC. */
export function BusinessName({ scope }: { scope: BusinessNameScope }) {
  return <>{useBusinessName(scope)}</>
}
