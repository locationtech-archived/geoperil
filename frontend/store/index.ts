import { GetterTree, ActionTree, MutationTree } from 'vuex'
import { RootState, Event, User, ComputeRequest } from "~/types"
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
export const API_COMPUTE_URL = WEBGUISRV_BASE_URL + 'compute'
export const API_UPDATE_URL = WEBGUISRV_BASE_URL + 'update'
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
})

export const getters: GetterTree<RootState, RootState> = {
  recentEvents: state => state.recentEvents,
  recentEventsGeojson: state => state.recentEventsGeojson,
  userEvents: state => state.userEvents,
  userEventsGeojson: state => state.userEventsGeojson,
  hoveredEvent: state => state.hoveredEvent,
  selectedEvent: state => state.selectedEvent,
  composeEvent: state => state.composeEvent,
  user: state => state.user,
  lastUpdate: state => state.lastUpdate,
  selectedTab: state => state.selectedTab,
}

export const mutations: MutationTree<RootState> = {
  SET_EVENTS: (state, events: Event[]) => (
    state.recentEvents = events
  ),
  SET_EVENTS_GEOJSON: (state, events: any) => (
    state.recentEventsGeojson = events
  ),
  SET_USEREVENTS: (state, events: Event[]) => (
    state.userEvents = events
  ),
  SET_USEREVENTS_GEOJSON: (state, events: any) => (
    state.userEventsGeojson = events
  ),
  SET_HOVERED: (state, hovered: Event | null) => (
    state.hoveredEvent = hovered
  ),
  SET_SELECTED: (state, selected: Event | null) => (
    state.selectedEvent = selected
  ),
  SET_COMPOSE: (state, compose: Event | null) => (
    state.composeEvent = compose
  ),
  SET_USER: (state, setuser: any) => (
    state.user = setuser
  ),
  SET_LAST_UPDATE: (state, ts: string) => (
    state.lastUpdate = ts
  ),
  SET_SELECTED_TAB: (state, tab: Number) => (
    state.selectedTab = tab
  ),
  ADD_EVENTS: (state, events: any[]) => {
    // we expect the entries to be in descending time order
    const revevents = events.reverse()
    for (let i = 0; i < revevents.length; i++) {
      addEntryToArr(
        revevents[i],
        state.recentEvents,
        state.recentEventsGeojson,
        false
      )
    }
  },
  ADD_USEREVENTS: (state, events: any[]) => {
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
  const datetime = new Date(props.date)
  const date = datetime.getFullYear() + '/'
    + (datetime.getMonth() + 1).toString().padStart(2, '0') + '/'
    + datetime.getDate().toString().padStart(2, '0')
  const time = datetime.getHours().toString().padStart(2, '0') + ':'
    + datetime.getMinutes().toString().padStart(2, '0') + ' UTC'

  return {
    identifier: entry._id,
    region: props.region,
    datetime: datetime,
    date: date,
    time: time,
    lat: props.latitude,
    lon: props.longitude,
    mag: props.magnitude,
    depth: props.depth,
    dip: props.dip,
    rake: props.rake,
    strike: props.strike,
    seaArea: props.sea_area,
    bbUrl: props.bb_url,
    progress: entry.progress,
    arrivaltimes: entry.arrivaltimes
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
  nuxtServerInit({ commit }, { req }) {
    if (req.session && req.session.user) {
      commit('SET_USER', req.session.user)
    }
  },

  async fetchEvents({ commit }) {
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
      throw new Error('Invalid response from fetch endpoint')
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

  async registerUpdater({ commit }) {
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

  async login({ commit }, { username, password }: any) {
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

  async session({ commit }) {
    const { data } = await axios.post(API_SESSION_URL)
    if ('status' in data
      && 'user' in data
      && data.status == 'success') {
      commit('SET_USER', data.user)
    } else {
      commit('SET_USER', null)
    }
  },

  async logout({ commit }) {
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

  async sendCompute({ commit }, compute: ComputeRequest) {
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
}
