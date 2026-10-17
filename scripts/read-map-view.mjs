// Read the last settled view from the most recently focused local map tab.
const args = process.argv.slice(2)
if (args.length && (args.length !== 2 || args[0] !== '--url' || !args[1])) {
  throw new Error('Usage: npm run read:view [-- --url http://localhost:5174]')
}
const response = await fetch(new URL('/__geo_go_go/view', args[1] ?? 'http://localhost:5173'))
if (!response.ok) throw new Error(await response.text())
console.log(JSON.stringify(await response.json(), null, 2))
