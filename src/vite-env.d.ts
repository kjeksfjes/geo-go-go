/// <reference types="vite/client" />

declare module 'world-atlas/countries-50m.json' {
  import type { Topology } from 'topojson-specification'

  const topology: Topology
  export default topology
}

declare module 'world-atlas/countries-10m.json' {
  import type { Topology } from 'topojson-specification'

  const topology: Topology
  export default topology
}
