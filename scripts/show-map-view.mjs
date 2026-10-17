// Move the most recently focused map tab connected to the Vite dev server.
const args = process.argv.slice(2)
const values = {}
for (let i = 0; i < args.length; i += 2) {
  const key = args[i]?.replace(/^--/, '')
  if (!['lat', 'lon', 'zoom', 'region', 'projection', 'url', 'animate'].includes(key) || !args[i + 1]) {
    throw new Error('Usage: npm run show:view -- --lat 59.2 --lon 5.7 --zoom 128 [--region world] [--projection mercator] [--animate false] [--url http://localhost:5173]')
  }
  values[key] = args[i + 1]
}
if (values.animate !== undefined && !['true', 'false'].includes(values.animate)) {
  throw new Error('--animate must be true or false')
}
const view = {
  lat: Number(values.lat), lon: Number(values.lon), zoom: Number(values.zoom),
  region: values.region ?? 'world', projection: values.projection ?? 'mercator',
  animate: values.animate !== 'false',
}
const response = await fetch(new URL('/__geo_go_go/view', values.url ?? 'http://localhost:5173'), {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(view),
})
if (!response.ok) throw new Error(await response.text())
console.log(await response.text())
