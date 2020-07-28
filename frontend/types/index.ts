export * from './state'

export interface User {
  username: string,
}

export interface Event {
  region: string,
  date: string,
  time: string,
  identifier: string,
  lat: number,
  lon: number,
  mag: number,
  depth: number,
  dip: number,
  strike: number,
  rake: number,
  seaArea: string,
  bbUrl: string,
}
