// Local-only writes to one maintained file; never runs in preview or production.
import { readFile, writeFile, rename, unlink, stat } from 'node:fs/promises'
import { resolve, dirname, join } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import ts from 'typescript'
import { readDraft, waterLabelBaseline } from '../src/dev/waterLabelDraft.ts'

const endpoint = '/__geo_go_go/water-label-project'
const fileName = 'src/data/marine-label-overrides.json'
const inputs = [fileName, 'src/data/marine-labels.json', 'src/data/marine-label-paths.json', 'src/data/marineLabelPaths.ts']

async function loadProject(root) {
  const contents = await Promise.all(inputs.map(path => readFile(resolve(root, path), 'utf8')))
  const revision = createHash('sha256').update(JSON.stringify(contents)).digest('hex')
  const [overrides, source] = contents.slice(0, 2).map(JSON.parse)
  const moduleSource = contents[3]
    .replace("import generated from './marine-label-paths.json'", `const generated = ${contents[2]}`)
    .replace("import overrides from './marine-label-overrides.json'", `const overrides = ${contents[0]}`)
  const output = ts.transpileModule(moduleSource, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const { marineLabelPaths: placements } = await import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`)
  const labels = [...source, ...overrides.addedLabels]
    .filter(label => !overrides.removedIds.includes(label.id))
    .map(label => ({ ...label, ...overrides.labelText[label.id] }))
  return { revision, labels, placements, overrides, source }
}
const publicState = ({ revision, labels, placements }) => ({ revision, labels, placements })
const failure = (status, message) => Object.assign(new Error(message), { status })

async function requestBody(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > 2_000_000) throw failure(413, 'Project save is too large.')
    chunks.push(chunk)
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) }
  catch { throw failure(400, 'Invalid JSON project save.') }
}

function mergeDraft(project, draft) {
  const hidden = new Set(draft.hiddenIds)
  const sourceIds = new Set(project.source.map(label => label.id))
  const addedLabels = [...project.overrides.addedLabels, ...Object.values(draft.customLabels)]
    .filter(label => !hidden.has(label.id))
  const removedIds = [...new Set([...project.overrides.removedIds, ...draft.hiddenIds.filter(id => sourceIds.has(id))])]
  const placements = { ...project.overrides.placements, ...draft.placements }
  const labelText = structuredClone(project.overrides.labelText)
  for (const [id, text] of Object.entries(draft.labelText)) labelText[id] = { ...labelText[id], ...text }
  for (const id of hidden) { delete placements[id]; delete labelText[id] }
  return { addedLabels, removedIds, placements, labelText }
}

export default function localWaterLabelProject() {
  let root, target, ownContent
  let writes = Promise.resolve()
  return {
    name: 'local-water-label-project',
    apply: 'serve',
    // Keep editor state/camera while its own save updates the imported JSON.
    async handleHotUpdate(context) {
      if (context.file === target && ownContent && await context.read() === ownContent) return []
    },
    configureServer(server) {
      root = server.config.root
      target = resolve(root, fileName)
      server.middlewares.use(endpoint, (request, response) => {
        const reply = (status, body) => {
          response.statusCode = status
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.setHeader('Cache-Control', 'no-store')
          response.end(JSON.stringify(body))
        }
        void (async () => {
          const host = request.headers.host ?? ''
          const origin = `${server.config.server.https ? 'https' : 'http'}://${host}`
          if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.socket.remoteAddress)
            || !/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)
            || (request.headers.origin && request.headers.origin !== origin)
            || request.headers['sec-fetch-site'] === 'cross-site') throw failure(403, 'Project saves are available only from this local map.')
          if (request.method === 'GET') { reply(200, publicState(await loadProject(root))); return }
          if (request.method !== 'POST') throw failure(405, 'Use GET or POST.')
          if (request.headers.origin !== origin || request.headers['content-type'] !== 'application/json') {
            throw failure(403, 'Save from the local editor using same-origin JSON.')
          }
          const body = await requestBody(request)
          const write = async () => {
            const project = await loadProject(root)
            if (body?.revision !== project.revision) throw failure(409, 'Project data changed. Export your draft and reload before saving; no file was changed.')
            let draft
            try { draft = readDraft(JSON.stringify(body.draft), waterLabelBaseline(project.labels, project.placements), new Set(project.labels.map(label => label.id))) }
            catch (error) { throw failure(400, error.message) }
            const content = JSON.stringify(mergeDraft(project, draft), null, 2) + '\n'
            const temporary = join(dirname(target), `.water-label-save-${randomUUID()}.tmp`)
            try {
              await writeFile(temporary, content, { flag: 'wx', mode: (await stat(target)).mode & 0o777 })
              if ((await loadProject(root)).revision !== project.revision) throw failure(409, 'Project data changed during save. Export your draft and reload; no file was changed.')
              ownContent = content
              await rename(temporary, target)
            } finally { await unlink(temporary).catch(() => {}) }
            return publicState(await loadProject(root))
          }
          const result = writes.then(write)
          writes = result.catch(() => {})
          reply(200, await result)
        })().catch(error => reply(error.status ?? 500, { error: error.status ? error.message : 'Could not save project data. Your browser draft is retained.' }))
      })
    },
  }
}
