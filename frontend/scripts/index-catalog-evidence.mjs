import { createHash } from 'node:crypto'
import { access, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

import {
  COMPONENT_REGISTRY,
  FRAME_REGISTRY,
} from '../src/dev/visual-catalog/registry.ts'

const evidenceDir = process.env.CATALOG_EVIDENCE_DIR

if (!evidenceDir) {
  throw new Error('CATALOG_EVIDENCE_DIR es obligatorio.')
}

const manifestPath = path.join(evidenceDir, 'manifest.json')
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
const frames = new Map(FRAME_REGISTRY.map((frame) => [frame.ref, frame]))

function kebabCase(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

const components = []

for (const component of COMPONENT_REGISTRY) {
  const suite = component.evidenceRefs[0]
    .replace('e2e/catalog/', '')
    .replace('.spec.ts', '')
  const directory = path.join(evidenceDir, suite)
  const prefix = `${kebabCase(component.name)}-1440-`
  const candidates = (await readdir(directory)).filter(
    (file) => file.startsWith(prefix) && file.endsWith('.png'),
  )

  if (candidates.length !== 1) {
    throw new Error(
      `${component.id}: se esperaba una captura 1440 con prefijo ${prefix}; encontradas ${candidates.length}.`,
    )
  }

  const actual = path.posix.join(suite, candidates[0])
  const bytes = await readFile(path.join(evidenceDir, actual))
  const frame =
    component.frameRef === 'A' ? undefined : frames.get(component.frameRef)
  const figma = frame ? `figma/${frame.nodeId.replace(':', '-')}.png` : null

  if (figma) {
    await access(path.join(evidenceDir, figma))
  }

  components.push({
    id: component.id,
    name: component.name,
    variant: 'catalog-default',
    frameRef: component.frameRef,
    nodesOrAdaptation: component.kind === 'A' ? 'A' : component.nodes,
    kind: component.kind,
    viewport: '1440x900',
    deviceScaleFactor: 1,
    browser: 'chromium',
    source: component.evidenceRefs[0],
    masks: [],
    threshold: 0.2,
    maxDiffPixelRatio: 0.005,
    figma,
    actual,
    diff: null,
    status: 'in-progress',
    sha256: sha256(bytes),
  })
}

manifest.components = components
manifest.generatedAt = new Date().toISOString()
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

const rows = components
  .map((component) => {
    const source = component.figma
      ? `<img src="${escapeHtml(component.figma)}" alt="Referencia Figma ${escapeHtml(component.frameRef)}">`
      : '<div class="adaptation">Adaptación A: sin node ID atribuido</div>'
    return `<article>
      <header><strong>${escapeHtml(component.id)} — ${escapeHtml(component.name)}</strong><span>${escapeHtml(component.frameRef)} · ${escapeHtml(component.kind)}</span></header>
      <div class="pair"><figure>${source}<figcaption>Referencia estructurada</figcaption></figure><figure><img src="${escapeHtml(component.actual)}" alt="Implementación ${escapeHtml(component.id)}"><figcaption>Implementación · Chromium 1440 px · DPR 1</figcaption></figure></div>
      <p>Nodos/adaptación: ${escapeHtml(component.nodesOrAdaptation === 'A' ? 'A' : component.nodesOrAdaptation.join(', '))} · Estado: en revisión</p>
    </article>`
  })
  .join('\n')

const gallery = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Auditoría visual C01–C66</title>
<style>body{margin:0;background:#fafafb;color:#030229;font:14px Nunito,system-ui,sans-serif}main{max-width:1500px;margin:auto;padding:32px}h1{margin:0 0 8px}aside{background:#efeeff;border-radius:10px;padding:16px;margin:20px 0 28px}article{background:white;border-radius:10px;padding:18px;margin:0 0 24px;box-shadow:0 10px 20px rgba(0,0,0,.06)}header{display:flex;justify-content:space-between;gap:16px;margin-bottom:14px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:20px}figure{margin:0;min-width:0}img{display:block;width:100%;height:auto;border-radius:5px;background:#fafafb}figcaption,p{color:#626176;font-size:12px}.adaptation{display:grid;place-items:center;min-height:220px;background:#f7f7f8;border-radius:5px;color:#626176}@media(max-width:800px){main{padding:16px}.pair{grid-template-columns:1fr}header{display:block}header span{display:block;margin-top:4px}}</style></head>
<body><main><h1>Auditoría visual C01–C66</h1><p>Cambio aplicar-catalogo-visual-frontend · fuentes obtenidas con get_design_context, no inferidas desde capturas.</p><aside><strong>Revisión requerida.</strong> Las imágenes Figma muestran el frame fuente completo y las capturas muestran el componente aislado. Los textos y datos de demostración no deben coincidir. Revise geometría, tipografía, color, elevación y jerarquía. Nada se promueve a approved ni verified sin aceptación explícita.</aside>${rows}</main></body></html>`

await writeFile(path.join(evidenceDir, 'comparacion.html'), gallery)
process.stdout.write(
  `Indexadas ${components.length} evidencias en ${manifestPath}\n`,
)
process.stdout.write(`Galería: ${path.join(evidenceDir, 'comparacion.html')}\n`)
