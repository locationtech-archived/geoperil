import { GetterTree, ActionTree, MutationTree } from 'vuex'
import { RootState, Event, User, Station, ComputeRequest } from "~/types"
import axios from 'axios'
import querystring from 'querystring'

// add trailing slash to URL if not present
// 'as string' needed for TS since it could be undefined, but should not
export const WEBGUISRV_BASE_URL = process.env.webguisrvUrl
  + ((process.env.webguisrvUrl as string).endsWith('/') ? '' : '/')
export const API_SIGNIN_URL = WEBGUISRV_BASE_URL + 'signin'
export const API_SESSION_URL = WEBGUISRV_BASE_URL + 'session'
export const API_SIGNOUT_URL = WEBGUISRV_BASE_URL + 'signout'
export const API_FETCH_URL = WEBGUISRV_BASE_URL + 'get_events'
export const API_STATIONLIST_URL = WEBGUISRV_BASE_URL + 'stationlist'
export const API_COMPUTE_URL = WEBGUISRV_BASE_URL + 'compute'
export const API_UPDATE_URL = WEBGUISRV_BASE_URL + 'update'
export const API_GETISOS_URL = WEBGUISRV_BASE_URL + 'getisos'
export const API_GETJETS_URL = WEBGUISRV_BASE_URL + 'getjets'
export const API_CHANGEPWD_URL = WEBGUISRV_BASE_URL + 'changepassword'
export const API_SAVEUSERSTATIONS_URL = WEBGUISRV_BASE_URL + 'saveuserstations'
export const FORM_ENCODE_CONFIG = {
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded'
  }
}
export const UPDATE_INTERVAL_MSEC = 1000

export const state = (): RootState => ({
  recentEvents: [],
  recentEventsGeojson: [],
  userEvents: [],
  userEventsGeojson: [],
  hoveredEvent: null,
  selectedEvent: null,
  composeEvent: null,
  user: null,
  lastUpdate: null,
  selectedTab: 0,
  mapIsLoading: false,
  resultArrivaltimes: null,
  resultWavejets: null,
  showSettingsDialog: false,
  allStations: null,
})

export const getters: GetterTree<RootState, RootState> = {
  recentEvents: (state: RootState) => state.recentEvents,
  recentEventsGeojson: (state: RootState) => state.recentEventsGeojson,
  userEvents: (state: RootState) => state.userEvents,
  userEventsGeojson: (state: RootState) => state.userEventsGeojson,
  hoveredEvent: (state: RootState) => state.hoveredEvent,
  selectedEvent: (state: RootState) => state.selectedEvent,
  composeEvent: (state: RootState) => state.composeEvent,
  user: (state: RootState) => state.user,
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
      !state.allStations || !state.user || state.user.countries.length == 0
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
}

export const mutations: MutationTree<RootState> = {
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
  SET_SELECTED: (state: RootState, selected: Event | null) => (
    state.selectedEvent = selected
  ),
  SET_COMPOSE: (state: RootState, compose: Event | null) => (
    state.composeEvent = compose
  ),
  SET_USER: (state: RootState, setuser: User | null) => (
    state.user = setuser
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
      state.user.countries = selected
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

  if (push) {
    evArr.push(evObj)
  } else {
    evArr.unshift(evObj)
  }

  const geojsonObj = apiToGeojson(entry)

  if (push) {
    geojsonArr.push(geojsonObj)
  } else {
    geojsonArr.unshift(geojsonObj)
  }
}

export const actions: ActionTree<RootState, RootState> = {
  // nuxtServerInit is called by Nuxt.js before server-rendering every page
  nuxtServerInit({ commit }: any, { req }: any) {
    if (req.session && req.session.user) {
      commit('SET_USER', req.session.user)
    }
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
      stationArr.push(
        {
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
      )
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
      commit(
        'SET_USER',
        {
          username: data.user.username,
          inst: data.user.inst,
          countries: data.user.countries
        } as User
      )
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

  async sendCompute({ commit }: any, compute: ComputeRequest) {
    const event = compute.event
    let requestBody = {}

    if (!!event.mag) {
      requestBody = {
        name: event.region,
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
}
