import { validateSharedMapView } from '../src/logic/sharedMapView.ts'

export default function localMapViewControl() {
  return {
    name: 'local-map-view-control',
    apply: 'serve',
    configureServer(server) {
      let activeClient
      const states = new WeakMap()
      server.ws.on('geo-go-go:active', (_data, client) => { activeClient = client })
      server.ws.on('geo-go-go:state', (data, client) => {
        if (!data || typeof data.busy !== 'boolean') return
        const view = validateSharedMapView(data.view)
        if (!view && !data.busy) return
        states.set(client, {
          view: view ?? states.get(client)?.view ?? null,
          busy: data.busy,
          reportedAt: new Date().toISOString(),
        })
      })
      server.middlewares.use('/__geo_go_go/view', (request, response) => {
        const reply = (status, message) => {
          response.statusCode = status
          response.setHeader('Content-Type', 'text/plain; charset=utf-8')
          response.end(message)
        }
        const address = request.socket.remoteAddress
        const host = request.headers.host ?? ''
        if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address ?? '')
          || !/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)) {
          reply(403, 'View commands are available only from this computer.'); return
        }
        if (request.headers.origin && request.headers.origin !== `http://${request.headers.host}`) {
          reply(403, 'Cross-origin view commands are not accepted.'); return
        }
        response.setHeader('Cache-Control', 'no-store')
        if (request.method === 'GET') {
          const state = activeClient && server.ws.clients.has(activeClient) && states.get(activeClient)
          if (!state) { reply(409, 'Focus an open map tab and wait for its view to settle first.'); return }
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.end(JSON.stringify(state))
          return
        }
        if (request.method !== 'POST' || request.headers['content-type'] !== 'application/json') {
          reply(405, 'Use POST with application/json.'); return
        }
        let body = ''
        request.on('data', chunk => {
          if (response.writableEnded) return
          body += String(chunk)
          if (body.length > 4096 && !response.writableEnded) reply(413, 'View command too large.')
        })
        request.on('end', () => {
          if (response.writableEnded) return
          let view
          try { view = validateSharedMapView(JSON.parse(body)) } catch { /* Invalid JSON. */ }
          if (!view) { reply(400, 'Invalid map view.'); return }
          if (!activeClient || !server.ws.clients.has(activeClient)) {
            reply(409, 'Focus an open map tab connected to this dev server first.'); return
          }
          activeClient.send('geo-go-go:view', view)
          reply(200, 'View command sent to the most recently focused map tab.')
        })
      })
    },
  }
}
