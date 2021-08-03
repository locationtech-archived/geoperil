// Geoperil - A platform for the computation and web-mapping of hazard specific
// geospatial data, as well as for serving functionality to handle, share, and
// communicate threat specific information in a collaborative environment.
//
// Copyright (C) 2021 GFZ German Research Centre for Geosciences
//
// SPDX-License-Identifier: Apache-2.0
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//   http://apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the Licence is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the Licence for the specific language governing permissions and
// limitations under the Licence.
//
// Contributors:
//   Johannes Spazier (GFZ)
//   Sven Reissland (GFZ)
//   Martin Hammitzsch (GFZ)
//   Matthias Rüster (GFZ)
//   Hannes Fuchs (GFZ)

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
  root: string,
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
