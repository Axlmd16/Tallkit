import {
  Barcode,
  Cube,
  CurrencyDollar,
  IdentificationCard,
  Info,
  Package,
  Receipt,
  Tag,
  TreeStructure,
} from '@phosphor-icons/react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'

import { useSession } from '@/features/auth/hooks'
import {
  describeProblem,
  type ProblemView,
} from '@/features/catalog-common/problem'
import { useMeasurementUnitList } from '@/features/measurement-units/hooks'
import { useProductBrandList } from '@/features/product-brands/hooks'
import { useProductCategoryList } from '@/features/product-categories/hooks'
import {
  Button,
  ButtonGroup,
  Checkbox,
  Field,
  FormSection,
  InlineNotice,
  Input,
  LeadingIcon,
  Select,
  Textarea,
} from '@/shared/ui'

import { useProductTaxOptions } from './hooks'
import type { CatalogRef, Product, ProductInput, TaxProjection } from './types'
import { VehicleBrandPicker } from './VehicleBrandPicker'

const QUANTITY = /^\d{1,12}(\.\d{1,6})?$/
const PRICE = /^\d{1,12}(\.\d{1,2})?$/

interface Draft {
  code: string
  manufacturerCode: string
  name: string
  description: string
  isKit: boolean
  categoryId: string
  unitId: string
  brandId: string
  vehicleBrands: CatalogRef[]
  quantity: string
  price: string
  taxId: string
}

function toDraft(product?: Product): Draft {
  return {
    code: product?.code ?? '',
    manufacturerCode: product?.manufacturer_code ?? '',
    name: product?.name ?? '',
    description: product?.description ?? '',
    isKit: product?.is_kit ?? false,
    categoryId: product?.category ? String(product.category.id) : '',
    unitId: product?.unit ? String(product.unit.id) : '',
    brandId: product?.product_brand ? String(product.product_brand.id) : '',
    vehicleBrands: product?.vehicle_brands ?? [],
    quantity: product?.content_quantity ?? '',
    price: product?.sale_price ?? '',
    taxId: product?.tax ? String(product.tax.id) : '',
  }
}

function sameIds(a: CatalogRef[], b: CatalogRef[]): boolean {
  const left = a.map((x) => x.id).sort((x, y) => x - y)
  const right = b.map((x) => x.id).sort((x, y) => x - y)
  return left.length === right.length && left.every((id, i) => id === right[i])
}

function withCurrent(options: CatalogRef[], current: CatalogRef | null) {
  if (!current || options.some((option) => option.id === current.id))
    return options
  return [...options, current]
}

function taxLabel(option: TaxProjection): string {
  const status =
    option.tax_status === 'applicable'
      ? `${option.rate}%`
      : option.tax_status === 'missing'
        ? 'vigencia pendiente'
        : 'vigencias ambiguas'
  return `${option.code} — ${option.name} (${status})`
}

/** Formulario de producto por grupos: identificación, presentación, referencias e importe/impuesto. */
export function ProductForm({
  product,
  onSubmit,
  onCancel,
  onDirtyChange,
  onReload,
}: {
  product?: Product | undefined
  /** Alta: datos completos. Edición: solo los campos modificados. */
  onSubmit: (data: Partial<ProductInput>) => Promise<void>
  onCancel: () => void
  onDirtyChange?: ((dirty: boolean) => void) | undefined
  onReload?: (() => void) | undefined
}) {
  const permissions = new Set(useSession().data?.permissions ?? [])
  const canChangePrice = !product || permissions.has('productos.cambiar_precio')
  const canConfigure = permissions.has('parametros.gestionar')
  const [draft, setDraft] = useState<Draft>(() => toDraft(product))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [problem, setProblem] = useState<ProblemView | null>(null)
  const [pending, setPending] = useState(false)

  const categories = useProductCategoryList({ isActive: 'true', pageSize: 100 })
  const units = useMeasurementUnitList({ isActive: 'true', pageSize: 100 })
  const brands = useProductBrandList({ isActive: 'true', pageSize: 100 })
  const taxes = useProductTaxOptions({ pageSize: 100 })

  const categoryOptions = withCurrent(
    categories.data?.results ?? [],
    product?.category ?? null,
  )
  const unitOptions = withCurrent(
    units.data?.results ?? [],
    product?.unit ?? null,
  )
  const brandOptions = withCurrent(
    brands.data?.results ?? [],
    product?.product_brand ?? null,
  )
  const taxOptions = taxes.data?.results ?? []
  const selectedTax =
    taxOptions.find((option) => String(option.id) === draft.taxId) ??
    (product?.tax && String(product.tax.id) === draft.taxId
      ? product.tax
      : null)

  const original = useMemo(() => toDraft(product), [product])
  const dirty = useMemo(
    () =>
      (Object.keys(draft) as Array<keyof Draft>).some((name) =>
        name === 'vehicleBrands'
          ? !sameIds(draft.vehicleBrands, original.vehicleBrands)
          : typeof draft[name] === 'string'
            ? (draft[name] as string).trim() !==
              (original[name] as string).trim()
            : draft[name] !== original[name],
      ),
    [draft, original],
  )
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange])

  function update<K extends keyof Draft>(
    name: K,
    value: Draft[K],
    field?: string,
  ) {
    setDraft((prev) => ({ ...prev, [name]: value }))
    if (field) setErrors((prev) => ({ ...prev, [field]: '' }))
  }

  function validate(): boolean {
    const next: Record<string, string> = {}
    if (!draft.code.trim()) next.code = 'El código interno es obligatorio.'
    else if (draft.code.trim().length > 64)
      next.code = 'El código interno no puede exceder 64 caracteres.'
    if (draft.manufacturerCode.trim().length > 64)
      next.manufacturer_code =
        'El código del fabricante no puede exceder 64 caracteres.'
    if (!draft.name.trim()) next.name = 'El nombre es obligatorio.'
    else if (draft.name.trim().length > 255)
      next.name = 'El nombre no puede exceder 255 caracteres.'
    if (draft.description.trim().length > 2000)
      next.description = 'La descripción no puede exceder 2000 caracteres.'
    if (!draft.categoryId) next.category_id = 'Seleccione una categoría.'
    if (!draft.unitId) next.unit_id = 'Seleccione una unidad de medida.'
    if (!draft.taxId)
      next.tax_definition_id = 'Seleccione la configuración tributaria.'
    const quantity = draft.quantity.trim()
    if (!QUANTITY.test(quantity) || Number(quantity) <= 0)
      next.content_quantity =
        'Use un número mayor que cero, con hasta 12 enteros y 6 decimales, con punto decimal.'
    if (!PRICE.test(draft.price.trim()))
      next.sale_price =
        'Use un importe en USD, con hasta 12 enteros y 2 decimales, con punto decimal. No se redondea automáticamente.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function buildPayload(): Partial<ProductInput> {
    const full: ProductInput = {
      code: draft.code.trim(),
      manufacturer_code: draft.manufacturerCode.trim(),
      name: draft.name.trim(),
      description: draft.description.trim(),
      category_id: Number(draft.categoryId),
      unit_id: Number(draft.unitId),
      product_brand_id: draft.brandId ? Number(draft.brandId) : null,
      vehicle_brand_ids: draft.vehicleBrands.map((brand) => brand.id),
      tax_definition_id: Number(draft.taxId),
      content_quantity: draft.quantity.trim(),
      sale_price: draft.price.trim(),
      is_kit: draft.isKit,
    }
    if (!product) {
      const { description, product_brand_id, manufacturer_code, ...required } =
        full
      return {
        ...required,
        ...(manufacturer_code ? { manufacturer_code } : {}),
        ...(description ? { description } : {}),
        ...(product_brand_id === null ? {} : { product_brand_id }),
      }
    }
    const before = toDraft(product)
    const changes: Partial<ProductInput> = {}
    if (draft.code.trim() !== before.code) changes.code = full.code
    if (draft.manufacturerCode.trim() !== before.manufacturerCode)
      changes.manufacturer_code = full.manufacturer_code
    if (draft.name.trim() !== before.name) changes.name = full.name
    if (draft.description.trim() !== before.description.trim())
      changes.description = full.description
    if (draft.categoryId !== before.categoryId)
      changes.category_id = full.category_id
    if (draft.unitId !== before.unitId) changes.unit_id = full.unit_id
    if (draft.brandId !== before.brandId)
      changes.product_brand_id = full.product_brand_id
    if (!sameIds(draft.vehicleBrands, before.vehicleBrands))
      changes.vehicle_brand_ids = full.vehicle_brand_ids
    if (draft.taxId !== before.taxId)
      changes.tax_definition_id = full.tax_definition_id
    if (draft.quantity.trim() !== before.quantity)
      changes.content_quantity = full.content_quantity
    if (draft.price.trim() !== before.price)
      changes.sale_price = full.sale_price
    if (draft.isKit !== before.isKit) changes.is_kit = full.is_kit
    return changes
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (pending) return
    setProblem(null)
    if (!validate()) return
    setPending(true)
    try {
      await onSubmit(buildPayload())
    } catch (error) {
      const view = describeProblem(error)
      setProblem(view)
      setErrors(view.fields)
    } finally {
      setPending(false)
    }
  }

  const noTaxConfiguration = taxes.isSuccess && taxOptions.length === 0
  const retrying = problem?.uncertain ?? false

  return (
    <form className="space-y-5" noValidate onSubmit={submit}>
      {problem && (
        <InlineNotice title="No se pudo guardar el producto" tone="danger">
          {problem.message}
          {problem.staleRecord && onReload && (
            <div className="mt-3">
              <Button onClick={onReload} type="button" variant="secondary">
                Cargar versión vigente
              </Button>
            </div>
          )}
        </InlineNotice>
      )}

      <FormSection
        description="Códigos y nombre con los que se reconoce el producto."
        icon={<IdentificationCard size={22} />}
        title="Identificación"
      >
        <Field error={errors.code} id="product-code" label="Código interno">
          <LeadingIcon icon={<Barcode size={20} />}>
            <Input
              className="pl-11"
              disabled={pending}
              id="product-code"
              maxLength={64}
              onChange={(e) => update('code', e.target.value, 'code')}
              value={draft.code}
            />
          </LeadingIcon>
        </Field>
        <Field
          error={errors.manufacturer_code}
          hint="Opcional. Número de parte del fabricante; no reemplaza al código interno."
          id="product-manufacturer-code"
          label="Código del fabricante"
        >
          <LeadingIcon icon={<Tag size={20} />}>
            <Input
              className="pl-11"
              disabled={pending}
              id="product-manufacturer-code"
              onChange={(e) =>
                update('manufacturerCode', e.target.value, 'manufacturer_code')
              }
              value={draft.manufacturerCode}
            />
          </LeadingIcon>
        </Field>
        <Field
          className="sm:col-span-2"
          error={errors.name}
          id="product-name"
          label="Nombre"
        >
          <Input
            disabled={pending}
            id="product-name"
            maxLength={255}
            onChange={(e) => update('name', e.target.value, 'name')}
            value={draft.name}
          />
        </Field>
        <Field
          className="sm:col-span-2"
          error={errors.description}
          id="product-description"
          label="Descripción (opcional)"
        >
          <Textarea
            disabled={pending}
            id="product-description"
            maxLength={2000}
            onChange={(e) =>
              update('description', e.target.value, 'description')
            }
            value={draft.description}
          />
        </Field>
      </FormSection>

      <FormSection
        description="Cada presentación vendible distinta es otro producto; no hay variantes ni conversión automática."
        icon={<Cube size={22} />}
        title="Presentación"
      >
        <Field
          error={errors.content_quantity}
          hint="Cantidad cerrada, por ejemplo 0.500000."
          id="product-quantity"
          label="Contenido"
        >
          <Input
            disabled={pending}
            id="product-quantity"
            inputMode="decimal"
            onChange={(e) =>
              update('quantity', e.target.value, 'content_quantity')
            }
            value={draft.quantity}
          />
        </Field>
        <Field
          error={errors.unit_id}
          id="product-unit"
          label="Unidad de medida"
        >
          <Select
            disabled={pending}
            id="product-unit"
            onChange={(e) => update('unitId', e.target.value, 'unit_id')}
            value={draft.unitId}
          >
            <option value="">Seleccione…</option>
            {unitOptions.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
                {unit.is_active ? '' : ' (inactiva)'}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex items-center gap-3 rounded-group border border-line bg-surface px-4 py-3 sm:col-span-2">
          <Package aria-hidden="true" className="text-primary" size={22} />
          <Checkbox
            checked={draft.isKit}
            disabled={pending}
            label="Es un kit comprado completo"
            onChange={(e) => update('isKit', e.target.checked)}
          />
        </div>
      </FormSection>

      <FormSection
        description="Clasificación del producto y compatibilidad con vehículos."
        icon={<TreeStructure size={22} />}
        title="Referencias"
      >
        <Field
          error={errors.category_id}
          id="product-category"
          label="Categoría"
        >
          <Select
            disabled={pending}
            id="product-category"
            onChange={(e) =>
              update('categoryId', e.target.value, 'category_id')
            }
            value={draft.categoryId}
          >
            <option value="">Seleccione…</option>
            {categoryOptions.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
                {category.is_active ? '' : ' (inactiva)'}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          error={errors.product_brand_id}
          id="product-brand"
          label="Marca de producto (opcional)"
        >
          <Select
            disabled={pending}
            id="product-brand"
            onChange={(e) =>
              update('brandId', e.target.value, 'product_brand_id')
            }
            value={draft.brandId}
          >
            <option value="">Sin marca</option>
            {brandOptions.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
                {brand.is_active ? '' : ' (inactiva)'}
              </option>
            ))}
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <VehicleBrandPicker
            disabled={pending}
            error={errors.vehicle_brand_ids}
            onChange={(next) =>
              update('vehicleBrands', next, 'vehicle_brand_ids')
            }
            selected={draft.vehicleBrands}
          />
        </div>
        {permissions.has('productos.gestionar') && (
          <p className="flex items-start gap-2 text-sm text-ink-muted sm:col-span-2">
            <Info
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-primary"
              size={16}
            />
            <span>
              ¿Falta una opción? Administre{' '}
              <a
                className="font-semibold text-primary underline"
                href="/product-categories"
                rel="noopener"
                target="_blank"
              >
                categorías
              </a>
              ,{' '}
              <a
                className="font-semibold text-primary underline"
                href="/measurement-units"
                rel="noopener"
                target="_blank"
              >
                unidades
              </a>{' '}
              o{' '}
              <a
                className="font-semibold text-primary underline"
                href="/product-brands"
                rel="noopener"
                target="_blank"
              >
                marcas de producto
              </a>{' '}
              en otra pestaña; este borrador se conserva.
            </span>
          </p>
        )}
      </FormSection>

      <FormSection
        description="Precio final al cliente y configuración tributaria."
        icon={<Receipt size={22} />}
        title="Precio y tributación"
      >
        <Field
          error={errors.sale_price}
          hint={
            canChangePrice
              ? 'Precio final en USD, con impuesto incluido cuando aplique.'
              : 'Cambiar el precio requiere el permiso de cambio de precio.'
          }
          id="product-price"
          label="Precio final (USD)"
        >
          <LeadingIcon icon={<CurrencyDollar size={20} />}>
            <Input
              className="pl-11"
              disabled={pending || !canChangePrice}
              id="product-price"
              inputMode="decimal"
              onChange={(e) => update('price', e.target.value, 'sale_price')}
              value={draft.price}
            />
          </LeadingIcon>
        </Field>
        {noTaxConfiguration ? (
          <div className="sm:col-span-2">
            <InlineNotice
              title="Configuración tributaria pendiente"
              tone="warning"
            >
              No hay definiciones de impuesto del RUC comercial. Un
              Administrador debe configurarlas antes de registrar productos.
              {canConfigure && (
                <>
                  {' '}
                  <a
                    className="font-semibold underline"
                    href="/configuration"
                    rel="noopener"
                    target="_blank"
                  >
                    Abrir configuración
                  </a>
                </>
              )}
            </InlineNotice>
          </div>
        ) : (
          <Field
            error={errors.tax_definition_id}
            hint="El precio no se recalcula al cambiar la tarifa."
            id="product-tax"
            label="Impuesto (RUC comercial)"
          >
            <Select
              disabled={pending || taxes.isPending}
              id="product-tax"
              onChange={(e) =>
                update('taxId', e.target.value, 'tax_definition_id')
              }
              value={draft.taxId}
            >
              <option value="">Seleccione…</option>
              {selectedTax &&
                !taxOptions.some((o) => o.id === selectedTax.id) && (
                  <option value={selectedTax.id}>
                    {taxLabel(selectedTax)}
                  </option>
                )}
              {taxOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {taxLabel(option)}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {selectedTax && selectedTax.tax_status !== 'applicable' && (
          <div className="sm:col-span-2">
            <InlineNotice title="Vigencia tributaria pendiente" tone="warning">
              Puede guardar el producto, pero no podrá usarse en operaciones
              económicas hasta que se configure una vigencia aplicable.
            </InlineNotice>
          </div>
        )}
      </FormSection>

      <ButtonGroup
        className="justify-end pt-2"
        label="Acciones del formulario de producto"
      >
        <Button
          disabled={pending}
          onClick={onCancel}
          type="button"
          variant="quiet"
        >
          Cancelar
        </Button>
        <Button
          aria-busy={pending}
          disabled={pending}
          type="submit"
          variant="primary"
        >
          {pending
            ? 'Guardando…'
            : retrying
              ? 'Reintentar envío'
              : product
                ? 'Guardar cambios'
                : 'Guardar producto'}
        </Button>
      </ButtonGroup>
    </form>
  )
}
