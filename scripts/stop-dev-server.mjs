import { execFileSync } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = realpathSync(fileURLToPath(new URL('..', import.meta.url)))

try {
  let listeners
  try {
    listeners = execFileSync('lsof', ['-nP', '-iTCP:5173', '-sTCP:LISTEN', '-t'], { encoding: 'utf8' }).trim()
  } catch (error) {
    if (error.status !== 1) throw error
    listeners = ''
  }
  if (!listeners) {
    console.log('No local server is listening on port 5173.')
  } else {
    const pids = [...new Set(listeners.split(/\s+/))]
    // Verify every listener before sending any signal. An occupied port alone
    // is not enough to identify this project's development server.
    for (const pid of pids) {
      if (!/^\d+$/.test(pid)) throw new Error('Unexpected server process ID.')
      const cwd = execFileSync('lsof', ['-a', '-p', pid, '-d', 'cwd', '-Fn'], { encoding: 'utf8' })
        .split('\n').find(line => line.startsWith('n'))?.slice(1)
      const command = execFileSync('ps', ['-p', pid, '-o', 'command='], { encoding: 'utf8' })
      if (!cwd || realpathSync(cwd) !== root || !/(?:^|\s)\S*\/(?:\.bin\/vite|vite\/bin\/vite\.js)(?:\s|$)/.test(command)) {
        throw new Error('Port 5173 belongs to another process; nothing was stopped.')
      }
    }
    for (const pid of pids) process.kill(Number(pid), 'SIGTERM')
    console.log('Stopped the project’s local server on port 5173 (localhost and local network).')
  }
} catch (error) {
  console.error(`Could not stop the local server: ${error.message}`)
  process.exitCode = 1
}
