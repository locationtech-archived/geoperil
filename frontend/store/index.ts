import { GetterTree, ActionTree, MutationTree } from 'vuex'
import { RootState, Event, ComputeRequest } from "~/types"
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
export const FORM_ENCODE_CONFIG = {
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded'
  }
}

export const state = (): RootState => ({
  recentEvents: [],
  recentEventsGeojson: [],
  hoveredEvent: null,
  selectedEvent: null,
  composeEvent: null,
  user: null,
  lastUpdate: null,
})

export const getters: GetterTree<RootState, RootState> = {
  recentEvents: state => state.recentEvents,
  recentEventsGeojson: state => state.recentEventsGeojson,
  hoveredEvent: state => state.hoveredEvent,
  selectedEvent: state => state.selectedEvent,
  composeEvent: state => state.composeEvent,
  user: state => state.user,
  lastUpdate: state => state.lastUpdate,
}

export const mutations: MutationTree<RootState> = {
  SET_EVENTS: (state, events: Event[]) => (
    state.recentEvents = events
  ),
  SET_EVENTS_GEOJSON: (state, events: any) => (
    state.recentEventsGeojson = events
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
    var evGeojsonArr: any[] = []

    const { data } = await axios.post(
      API_FETCH_URL,
      querystring.stringify({
        limit: 200,
      }),
      FORM_ENCODE_CONFIG
    )

    if (!('events' in data) || !('ts' in data)) {
      throw new Error('Invalid response from fetch backend')
    }

    for (let i = 0; i < data.events.length; i++) {
      const entry = data.events[i]
      const props = entry.prop
      const datetime = new Date(props.date)
      const date = datetime.getUTCFullYear() + '/'
        + (datetime.getUTCMonth() + 1).toString().padStart(2, '0') + '/'
        + datetime.getUTCDate().toString().padStart(2, '0')
      const time = datetime.getUTCHours().toString().padStart(2, '0') + ':'
        + datetime.getUTCMinutes().toString().padStart(2, '0') + ' UTC'
      evArr.push(
        {
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
        } as Event
      )

      evGeojsonArr.push(
        {
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
      )
    }

    commit('SET_EVENTS', evArr)
    commit('SET_EVENTS_GEOJSON', evGeojsonArr)
    commit('SET_LAST_UPDATE', data.ts)
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
  },
}
