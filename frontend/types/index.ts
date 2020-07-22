export * from './state'

export interface Event {
  name: string
  date: string
  time: string
  identifier: string
  lat: number
  lon: number
  depth: number
  dip: number
  strike: number
  rake: number
  infotext: string
}
