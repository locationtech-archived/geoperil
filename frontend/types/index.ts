export * from './state'
export * from './plugins-state'

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
  countries: string[],
  permissions: any | null,
  properties: any | null,
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
  mag: number | null,
  depth: number,
  dip: number | null,
  strike: number | null,
  rake: number | null,
  slip: number | null,
  len: number | null,
  width: number | null,
  seaArea: string,
  bbUrl: string | null,
  progress: number | null,
  calctime: number | null,
  gridres: number | null,
  algo: string | null,
  duration: number | null,
}

export interface Station {
  id: string,
  name: string,
  country: string,
  countryname: string,
  lon: number,
  lat: number,
  location: string,
  slmcode: string,
  units: string,
  sensor: string,
  type: string,
  inst: string,
  offset: number,
}
