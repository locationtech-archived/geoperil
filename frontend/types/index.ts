export * from './state'

export interface User {
  username: string,
}

export interface ComputeRequest {
  event: Event,
  duration: number,
  algorithm: string,
  gridres: number,
}

export interface Event {
  region: string,
  datetime: Date,
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
  slip: number,
  len: number,
  width: number,
  seaArea: string,
  bbUrl: string,
}
