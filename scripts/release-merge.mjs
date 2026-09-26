import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const checkOnly = process.argv[2] === '--check'
let switchedToMain = false
let merged = false

function run(command, args, inherit = false) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: inherit ? 'inherit' : 'pipe',
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed${result.stderr?.trim() ? `: ${result.stderr.trim()}` : ''}`)
  }
  return result.stdout?.trim() ?? ''
}

function git(args) {
  return run('git', args)
}

function gitSucceeds(args) {
  const result = spawnSync('git', args, { cwd: root, stdio: 'ignore' })
  if (result.error) throw result.error
  return result.status === 0
}

function versionParts(version) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`Expected a numeric major.minor.patch version, found ${version}`)
  }
  return version.split('.').map(Number)
}

function isNewerVersion(next, previous) {
  const nextParts = versionParts(next)
  const previousParts = versionParts(previous)
  for (let index = 0; index < 3; index += 1) {
    if (nextParts[index] !== previousParts[index]) return nextParts[index] > previousParts[index]
  }
  return false
}

try {
  if (process.argv.length > 3 || (process.argv[2] && !checkOnly)) {
    throw new Error('Usage: npm run release:merge [-- --check]')
  }

  const branch = git(['branch', '--show-current'])
  if (!branch || branch === 'main') throw new Error('Run this from a release branch, not main or a detached HEAD.')
  if (git(['status', '--porcelain'])) throw new Error('Commit or set aside all working-tree changes first.')
  if (!gitSucceeds(['show-ref', '--verify', '--quiet', 'refs/heads/main'])) {
    throw new Error('Local main branch not found.')
  }
  if (!gitSucceeds(['merge-base', '--is-ancestor', 'main', 'HEAD'])) {
    throw new Error('Main has moved since this branch was created. Bring main into the branch first.')
  }

  const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'))
  if (lock.version !== version || lock.packages[''].version !== version) {
    throw new Error('package.json and package-lock.json must have the same version.')
  }

  const previousVersion = JSON.parse(git(['show', 'main:package.json'])).version
  if (!isNewerVersion(version, previousVersion)) {
    throw new Error(`Release version ${version} must be newer than main's ${previousVersion}.`)
  }
  if (previousVersion !== '0.0.0' && !gitSucceeds(['rev-parse', '-q', '--verify', `refs/tags/v${previousVersion}`])) {
    throw new Error(`Previous release tag v${previousVersion} is missing.`)
  }
  const tag = `v${version}`
  if (gitSucceeds(['rev-parse', '-q', '--verify', `refs/tags/${tag}`])) {
    throw new Error(`Tag ${tag} already exists.`)
  }

  const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8')
  const entry = changelog.split(/^## /m).find((section) => section.startsWith(`${version} `) || section.startsWith(`${version}\n`))
  if (!entry || !entry.slice(entry.indexOf('\n') + 1).trim()) {
    throw new Error(`CHANGELOG.md needs a nonempty ${version} entry.`)
  }

  console.log(`Checking ${tag} from ${branch} before merging into main...`)
  run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], true)
  if (checkOnly) {
    console.log(`${tag} is ready. No branches or tags were changed.`)
  } else {
    run('git', ['switch', 'main'], true)
    switchedToMain = true
    run('git', ['merge', '--no-ff', '--no-edit', branch], true)
    merged = true
    if (!gitSucceeds(['merge-base', '--is-ancestor', branch, 'HEAD'])) {
      throw new Error('Merged HEAD does not contain the release branch; tag was not created.')
    }
    run('git', ['tag', '-a', tag, '-m', `Geo Go Go ${version}`], true)
    console.log(`Merged ${branch} into main and tagged ${tag}.`)
  }
} catch (error) {
  const stage = merged
    ? 'Merge completed, but release tagging failed'
    : switchedToMain
      ? 'Merge failed after switching to main; inspect git status before retrying'
      : 'Release merge stopped before changing branches'
  console.error(`${stage}: ${error.message}`)
  process.exitCode = 1
}
