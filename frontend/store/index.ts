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

import querystring from 'querystring'
import { GetterTree, ActionTree, MutationTree } from 'vuex'
import axios from 'axios'
import {
  API_PLUGINS_URL,
  API_SIGNIN_URL,
  API_SESSION_URL,
  API_SIGNOUT_URL,
  API_FETCH_URL,
  API_STATIONLIST_URL,
  API_COMPUTE_URL,
  API_UPDATE_URL,
  API_GETISOS_URL,
  API_GETJETS_URL,
  API_CHANGEPWD_URL,
  API_SAVEUSERSTATIONS_URL,
  FORM_ENCODE_CONFIG,
  UPDATE_INTERVAL_MSEC,
  API_INSTLIST_URL,
} from './constants'
import {
  RootState,
  Event,
  User,
  Station,
  ComputeRequest,
} from '~/types'
import {
  pluginsState,
  pluginsGetters,
  pluginsMutations,
  pluginsActions,
} from '~/store/plugins-store'

export const state = (): RootState => ({
  supportedPlugins: {},
  recentEvents: [],
  recentEventsGeojson: [],
  userEvents: [],
  userEventsGeojson: [],
  hoveredEvent: null,
  selectedEvent: null,
  composeEvent: null,
  user: null,
  allInstitutions: null,
  lastUpdate: null,
  selectedTab: 0,
  mapIsLoading: false,
  resultArrivaltimes: null,
  resultWavejets: null,
  showSettingsDialog: false,
  allStations: null,
  stationTimestamp: new Date(),
  stationHoveredMap: null,
  selectedStationMap: null,
  selectedStationDetail: null,
  ...pluginsState
})

export const getters: GetterTree<RootState, RootState> = {
  supportedPlugins: (state: RootState) => state.supportedPlugins,
  recentEvents: (state: RootState) => state.recentEvents,
  recentEventsGeojson: (state: RootState) => state.recentEventsGeojson,
  userEvents: (state: RootState) => state.userEvents,
  userEventsGeojson: (state: RootState) => state.userEventsGeojson,
  hoveredEvent: (state: RootState) => state.hoveredEvent,
  selectedEvent: (state: RootState) => state.selectedEvent,
  composeEvent: (state: RootState) => state.composeEvent,
  user: (state: RootState) => state.user,
  allInstitutions: (state: RootState) => state.allInstitutions,
  lastUpdate: (state: RootState) => state.lastUpdate,
  selectedTab: (state: RootState) => state.selectedTab,
  mapIsLoading: (state: RootState) => state.mapIsLoading,
  resultArrivaltimes: (state: RootState) => state.resultArrivaltimes,
  resultWavejets: (state: RootState) => state.resultWavejets,
  showSettingsDialog: (state: RootState) => state.showSettingsDialog,
  allStations: (state: RootState) => state.allStations,
  stationCountByCountry: (state: RootState) => {
    var bycountry: any = {}

    if (!state.allStations) {
      return bycountry
    }

    for (let i = 0; i < state.allStations.length; i++) {
      const name = state.allStations[i].country
      if (!(name in bycountry)) {
        bycountry[name] = 1
      } else {
        bycountry[name]++
      }
    }

    return bycountry
  },
  selectedStations: (state: RootState) => {
    if (
      !state.allStations || !state.user || !state.user.countries
      || state.user.countries.length == 0
    ) {
      return []
    }

    var filtered: Station[] = []

    state.allStations.forEach((f: Station) => {
      if (state.user!.countries.includes(f.country)) {
        filtered.push(f)
      }
    })

    return filtered
  },
  stationTimestamp: (state: RootState) => state.stationTimestamp,
  stationHoveredMap: (state: RootState) => state.stationHoveredMap,
  selectedStationMap: (state: RootState) => state.selectedStationMap,
  selectedStationDetail: (state: RootState) => state.selectedStationDetail,
  isAdmin: (state: RootState) => {
    const user: User | null = state.user

    if (!user || !user.permissions) {
      return false
    }

    return 'admin' in user.permissions && user.permissions.admin === true
  },
  ...pluginsGetters
}

export const mutations: MutationTree<RootState> = {
  SET_SUPPORTED_PLUGINS: (state: RootState, plugins: any) => (
    state.supportedPlugins = plugins
  ),
  SET_EVENTS: (state: RootState, events: Event[]) => (
    state.recentEvents = events
  ),
  SET_EVENTS_GEOJSON: (state: RootState, events: any) => (
    state.recentEventsGeojson = events
  ),
  SET_USEREVENTS: (state: RootState, events: Event[]) => (
    state.userEvents = events
  ),
  SET_USEREVENTS_GEOJSON: (state: RootState, events: any) => (
    state.userEventsGeojson = events
  ),
  SET_HOVERED: (state: RootState, hovered: Event | null) => (
    state.hoveredEvent = hovered
  ),
  SET_SELECTED_EVENT: (state: RootState, selected: Event | null) => {
    if (!state.selectedEvent && !selected) {
      // do not change null to null
      return
    }

    state.selectedEvent = selected

    if (selected) {
      state.stationTimestamp = selected.datetime
    } else {
      state.stationTimestamp = new Date()
    }
  },
  SET_COMPOSE: (state: RootState, compose: Event | null) => (
    state.composeEvent = compose
  ),
  SET_USER: (state: RootState, setuser: User | null) => (
    state.user = setuser
  ),
  SET_ALLINSTITUTIONS: (state: RootState, instArr: string[] | null) => (
    state.allInstitutions = instArr
  ),
  SET_LAST_UPDATE: (state: RootState, ts: string) => (
    state.lastUpdate = ts
  ),
  SET_SELECTED_TAB: (state: RootState, tab: Number) => (
    state.selectedTab = tab
  ),
  SET_MAP_IS_LOADING: (state: RootState, loading: Boolean) => (
    state.mapIsLoading = loading
  ),
  SET_RESULT_ARRIVALTIMES: (state: RootState, arr: Array<any> | null) => (
    state.resultArrivaltimes = arr
  ),
  SET_RESULT_WAVEJETS: (state: RootState, arr: Array<any> | null) => (
    state.resultWavejets = arr
  ),
  SET_SHOWSETTINGSDIALOG: (state: RootState, show: Boolean) => (
    state.showSettingsDialog = show
  ),
  SET_ALLSTATIONS: (state: RootState, all: Station[]) => (
    state.allStations = all
  ),
  SET_USERSTATIONS: (state: RootState, selected: string[]) => {
    if (state.user) {
      // notify components about the change
      // see https://vuejs.org/v2/guide/reactivity.html#For-Objects
      state.user = Object.assign({}, state.user, {countries: selected})
    }
  },
  ADD_EVENTS: (state: RootState, events: any[]) => {
    // we expect the entries to be in descending time order
    const revevents = events.reverse()
    for (let i = 0; i < revevents.length; i++) {
      let foundindex = null

      for (let j = 0; j < state.recentEvents.length; j++) {
        if (revevents[i].id == state.recentEvents[j].identifier) {
          foundindex = j
          break
        }
      }

      if (foundindex != null) {
        // overwrite existing entry
        // use splice to let vue detect the change
        // see https://vuejs.org/v2/guide/reactivity.html#Change-Detection-Caveats
        state.recentEvents.splice(
          foundindex, 1, apiToEvent(revevents[i])
        )
        state.recentEventsGeojson.splice(
          foundindex, 1, apiToGeojson(revevents[i])
        )
      } else {
        addEntryToArr(
          revevents[i],
          state.recentEvents,
          state.recentEventsGeojson,
          false
        )
      }
    }
  },
  ADD_USEREVENTS: (state: RootState, events: any[]) => {
    // we expect the entries to be in descending time order
    const revevents = events.reverse()
    for (let i = 0; i < revevents.length; i++) {
      let foundindex = null

      for (let j = 0; j < state.userEvents.length; j++) {
        if (revevents[i].id == state.userEvents[j].identifier) {
          foundindex = j
          break
        }
      }

      if (foundindex != null) {
        // overwrite existing entry
        // use splice to let vue detect the change
        // see https://vuejs.org/v2/guide/reactivity.html#Change-Detection-Caveats
        state.userEvents.splice(
          foundindex, 1, apiToEvent(revevents[i])
        )
        state.userEventsGeojson.splice(
          foundindex, 1, apiToGeojson(revevents[i])
        )
      } else {
        addEntryToArr(
          revevents[i],
          state.userEvents,
          state.userEventsGeojson,
          false
        )
      }
    }
  },
  SET_STATION_TIMESTAMP: (state: RootState, time: Date) => (
    state.stationTimestamp = time
  ),
  SET_STATION_HOVERED_MAP: (state: RootState, id: string) => (
    state.stationHoveredMap = id
  ),
  SET_SELECTED_STATION_MAP: (state: RootState, selected: Station | null) => {
    if (!state.selectedStationMap && !selected) {
      // do not change null to null
      return
    }

    state.selectedStationMap = selected
  },
  SET_SELECTED_STATION_DETAIL: (state: RootState, selected: Station | null) => (
    state.selectedStationDetail = selected
  ),
  ...pluginsMutations
}

function apiToEvent(entry: any): Event {
  const props = entry.prop
  const datetime = new Date(props.date) // this has the local timezone
  const year = datetime.getFullYear()
  const month = datetime.getMonth()
  const day = datetime.getDate()
  const hour = datetime.getHours()
  const min = datetime.getMinutes()
  const sec = datetime.getSeconds()
  const date = year + '/'
    + (month + 1).toString().padStart(2, '0') + '/'
    + day.toString().padStart(2, '0')
  const time = hour.toString().padStart(2, '0') + ':'
    + min.toString().padStart(2, '0') + ' UTC'

  return {
    compId: entry._id,
    identifier: entry.id,
    root: props.root,
    region: props.region,
    datetime: new Date(Date.UTC(year, month, day, hour, min, sec)),
    date: date,
    time: time,
    lat: props.latitude,
    lon: props.longitude,
    mag: props.magnitude,
    depth: props.depth,
    slip: props.slip,
    len: props['length'],
    width: props.width,
    dip: props.dip,
    rake: props.rake,
    strike: props.strike,
    seaArea: props.sea_area,
    bbUrl: props.bb_url,
    progress: entry.progress,
    calctime: entry.calctime,
    gridres: props.gridres,
    algo: props.algo,
    duration: props.comp
  } as Event
}

function apiToGeojson(entry: any): any {
  const props = entry.prop
  return {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [ props.longitude, props.latitude ]
    },
    properties: {
      mag: props.magnitude,
      depth: props.depth
    }
  }
}

function addEntryToArr(
  entry: any,
  evArr: Event[],
  geojsonArr: any[],
  push: boolean = true
) {
  const evObj = apiToEvent(entry)
  Object.freeze(evObj)

  if (push) {
    evArr.push(evObj)
  } else {
    evArr.unshift(evObj)
  }

  const geojsonObj = apiToGeojson(entry)
  Object.freeze(geojsonObj)

  if (push) {
    geojsonArr.push(geojsonObj)
  } else {
    geojsonArr.unshift(geojsonObj)
  }
}

export const actions: ActionTree<RootState, RootState> = {
  async getSupportedPlugins({ commit }: any) {
    const { data } = await axios.post(API_PLUGINS_URL)

    if (
      !('status' in data) || data.status != 'success'
      || !('plugins' in data)
    ) {
      throw new Error('Invalid response from endpoint')
    }

    commit('SET_SUPPORTED_PLUGINS', data.plugins)
  },

  async fetchEvents({ commit }: any) {
    var evArr: Event[] = []
    var evUserArr: Event[] = []
    var evGeojsonArr: any[] = []
    var evUserGeojsonArr: any[] = []

    const { data } = await axios.post(API_FETCH_URL)

    if (
      !('events' in data)
      || !('userevents' in data)
      || !('maxtime' in data)
    ) {
      throw new Error('Invalid response from endpoint')
    }

    for (let i = 0; i < data.events.length; i++) {
      addEntryToArr(data.events[i], evArr, evGeojsonArr)
    }

    for (let i = 0; i < data.userevents.length; i++) {
      addEntryToArr(data.userevents[i], evUserArr, evUserGeojsonArr)
    }

    commit('SET_EVENTS', evArr)
    commit('SET_EVENTS_GEOJSON', evGeojsonArr)
    commit('SET_USEREVENTS', evUserArr)
    commit('SET_USEREVENTS_GEOJSON', evUserGeojsonArr)
    commit('SET_LAST_UPDATE', data.maxtime)
  },

  async fetchStations({ commit }: any) {
    const { data } = await axios.post(API_STATIONLIST_URL)

    if (
      !('status' in data) || data.status != 'success'
      || !('stations' in data)
    ) {
      throw new Error('Invalid response from endpoint')
    }

    var stationArr: Station[] = []
    for (let i = 0; i < data.stations.length; i++) {
      const sta = data.stations[i]
      const staObj: Station = {
        id: sta._id,
        name: sta.name,
        country: sta.country,
        countryname: sta.countryname,
        lon: sta.lon,
        lat: sta.lat,
        location: sta.Location,
        slmcode: sta.slmcode,
        units: sta.units,
        sensor: sta.sensor,
        type: sta.slmcode,
        inst: sta.inst,
        offset: sta.offset,
      } as Station

      Object.freeze(staObj)
      stationArr.push(staObj)
    }

    commit('SET_ALLSTATIONS', stationArr)
  },

  async registerUpdater({ commit }: any) {
    const updateCall = async () => {
      var extraMsec = 0
      var lastts = this.getters.lastUpdate

      if (!lastts) {
        lastts = (new Date(0)).toISOString()
      }

      const requestBody = {
        ts: lastts
      }

      try {
        const { data } = await axios.post(
          API_UPDATE_URL,
          querystring.stringify(requestBody),
          FORM_ENCODE_CONFIG
        )

        if ('status' in data && data.status == 'denied') {
          // check if session is still valid
          this.dispatch('session')
          return
        }

        if (!('events' in data && 'userevents' in data && 'maxtime' in data)) {
          console.error('Invalid response from update endpoint')
          // try again later
          setTimeout(updateCall, UPDATE_INTERVAL_MSEC + 5000)
          return
        }

        const events = data.events
        const userevents = data.userevents
        const maxtime = data.maxtime

        if (events.length > 0) {
          commit('ADD_EVENTS', events)
        }

        if (userevents.length > 0) {
          commit('ADD_USEREVENTS', userevents)
        }

        if (maxtime) {
          commit('SET_LAST_UPDATE', maxtime)
        }
      } catch (error) {
        // wait longer to avoid spamming the server
        extraMsec = 5000
        // TODO: display error message in frontend
      }

      setTimeout(updateCall, UPDATE_INTERVAL_MSEC + extraMsec)
    }

    // start continuous update
    setTimeout(updateCall, UPDATE_INTERVAL_MSEC)
  },

  async login({ commit }: any, { username, password }: any) {
    const requestBody = {
      username: username,
      password: password
    }

    try {
      const { data } = await axios.post(
        API_SIGNIN_URL,
        querystring.stringify(requestBody),
        FORM_ENCODE_CONFIG
      )
      if ('status' in data
        && 'user' in data
        && data.status == 'success') {
        commit('SET_USER', data.user)
      } else {
        throw new Error('Invalid credentials')
      }
    } catch (error) {
      if (error.response && error.response.status === 401) {
        throw new Error('Invalid credentials')
      }
      throw error
    }
  },

  async session({ commit }: any) {
    const { data } = await axios.post(API_SESSION_URL)

    if ('status' in data
      && 'user' in data
      && data.status == 'success') {
      commit('SET_USER', data.user)
    } else {
      commit('SET_USER', null)
    }
  },

  async logout({ commit }: any) {
    const user = this.getters.user

    if (!('username' in user) || !user.username) {
      throw new Error('You are not logged in')
    }

    const { data } = await axios.post(API_SIGNOUT_URL)
    if ('status' in data && data.status == 'success') {
      commit('SET_USER', null)
    } else {
      throw new Error('Logout was not succesfull')
    }
  },

  async fetchAllInstitutions({ commit }: any) {
    if (!this.getters.isAdmin) {
      return
    }

    try {
      const { data } = await axios.post(
        API_INSTLIST_URL,
        querystring.stringify({}),
        FORM_ENCODE_CONFIG
      )
      if ('status' in data
        && 'institutions' in data
        && data.status == 'success') {
        commit('SET_ALLINSTITUTIONS', data.institutions)
      } else {
        throw new Error('Invalid response while getting institutions')
      }
    } catch (error) {
      throw error
    }
  },

  async sendCompute({ commit }: any, compute: ComputeRequest) {
    const event = compute.event
    let requestBody: any = {}

    if (!!event.mag) {
      requestBody = {
        name: event.region,
        root: event.root,
        lat: event.lat,
        lon: event.lon,
        depth: event.depth,
        dip: event.dip,
        strike: event.strike,
        rake: event.rake,
        dur: compute.duration,
        mag: event.mag,
        // root
        // parent
        date: event.datetime.toISOString(),
        algo: compute.algorithm.toLowerCase(),
        gridres: compute.gridres
      }
    } else {
      requestBody = {
        name: event.region,
        root: event.root,
        lat: event.lat,
        lon: event.lon,
        depth: event.depth,
        dip: event.dip,
        strike: event.strike,
        rake: event.rake,
        dur: compute.duration,
        slip: event.slip,
        length: event.len,
        width: event.width,
        // root
        // parent
        date: event.datetime.toISOString(),
        algo: compute.algorithm.toLowerCase(),
        gridres: compute.gridres
      }
    }

    const stations: Station[] = this.getters.selectedStations
    if (stations && stations.length > 0) {
      var pois = []

      for (let i = 0; i < stations.length; i++) {
        const cur = stations[i]
        pois.push({
          name: cur.name,
          lat: cur.lat,
          lon: cur.lon
        })
      }

      requestBody.pois = JSON.stringify(pois)
    }

    const { data } = await axios.post(
      API_COMPUTE_URL,
      querystring.stringify(requestBody),
      FORM_ENCODE_CONFIG
    )

    if (!data || !('status' in data && data.status == 'success')) {
      throw new Error('Sending the computation request was not successful')
    }

    // TODO: select next incoming event update if it matches the new created ID
    // commit('SET_NEXT_SELECTED', --> new ID)
  },

  async fetchResults({ commit }: any) {
    const selected: Event = this.getters.selectedEvent

    if (selected && selected.progress == 100) {
      commit('SET_MAP_IS_LOADING', true)

      const arrResp = await axios.post(
        API_GETISOS_URL,
        querystring.stringify({evid: selected.compId}),
        FORM_ENCODE_CONFIG
      )

      const arrivaldata = arrResp.data

      if (
        !arrivaldata
        || !('status' in arrivaldata && arrivaldata.status == 'success')
        || !('isos' in arrivaldata)
      ) {
        commit('SET_MAP_IS_LOADING', false)
        throw new Error('Getting the arrival times was not successful')
      }

      const waveResp = await axios.post(
        API_GETJETS_URL,
        querystring.stringify({evid: selected.compId}),
        FORM_ENCODE_CONFIG
      )

      const wavedata = waveResp.data

      if (
        !wavedata
        || !('status' in wavedata && wavedata.status == 'success')
        || !('jets' in wavedata)
      ) {
        commit('SET_MAP_IS_LOADING', false)
        throw new Error('Getting the wavejets was not successful')
      }

      // we use arrival times as indicator for a new result data set,
      // so setting it at last is important
      commit('SET_RESULT_WAVEJETS', wavedata.jets)
      commit('SET_RESULT_ARRIVALTIMES', arrivaldata.isos)
    } else {
      commit('SET_RESULT_WAVEJETS', null)
      commit('SET_RESULT_ARRIVALTIMES', null)
    }
  },

  async saveuserstations( { commit }: any, selected: string[]) {
    const all: any = this.getters.stationCountByCountry

    if (!all || all.length == 0) {
      throw new Error('Internal error: Could not get stations')
    }

    const resp = await axios.post(
      API_SAVEUSERSTATIONS_URL,
      querystring.stringify({'stations': selected}),
      FORM_ENCODE_CONFIG
    )

    const respdata = resp.data

    if (
      !respdata
      || !('status' in respdata && respdata.status == 'success')
      || !('user' in respdata) || !('countries' in respdata.user)
    ) {
      throw new Error('Saving the stations was not successful')
    }

    commit('SET_USERSTATIONS', respdata.user.countries)
  },

  async changePassword({ commit }: any, changeRequest: any) {
    if (!('curpwd' in changeRequest && 'newpwd' in changeRequest)) {
      console.error('Internal error: Invalid call of changePassword')
    }

    const resp = await axios.post(
      API_CHANGEPWD_URL,
      querystring.stringify(changeRequest),
      FORM_ENCODE_CONFIG
    )

    const respdata = resp.data

    if (
      !respdata
      || !('status' in respdata && respdata.status == 'success')
    ) {
      throw new Error('Changing the password was not successful')
    }
  },

  ...pluginsActions
}
