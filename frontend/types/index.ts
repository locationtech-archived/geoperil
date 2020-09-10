export * from './state'

export interface UserApi {
  key: string,
  enabled: boolean,
}

export interface Institution {
  name: string,
  api: UserApi,
  descr: string,
  msg_name: string,
}

export interface User {
  username: string,
  inst: Institution,
  countries: any, // TODO
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
  compId: string,
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
  progress: number | null,
  arrivaltimes: string | null,
}
