import { GetterTree, ActionTree, MutationTree } from 'vuex'
import { RootState, Event } from "~/types"
import axios from 'axios'
import querystring from 'querystring'

export const API_SIGNIN_URL = process.env.apiUrl + 'signin'
export const API_SESSION_URL = process.env.apiUrl + 'session'
export const API_SIGNOUT_URL = process.env.apiUrl + 'signout'
export const API_FETCH_URL = process.env.apiUrl + 'fetch'
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
  authUser: null
})

export const getters: GetterTree<RootState, RootState> = {
  authUser: state => state.authUser,
  recentEvents: state => state.recentEvents,
  recentEventsGeojson: state => state.recentEventsGeojson,
  hoveredEvent: state => state.hoveredEvent,
  selectedEvent: state => state.selectedEvent,
}

export const mutations: MutationTree<RootState> = {
  SET_USER: (state, user: any) => (
    state.authUser = user
  ),
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
}

export const actions: ActionTree<RootState, RootState> = {
  // nuxtServerInit is called by Nuxt.js before server-rendering every page
  nuxtServerInit ({ commit }, { req }) {
    if (req.session && req.session.authUser) {
      commit('SET_USER', req.session.authUser)
    }
  },

  async fetchEvents({ commit }) {
    var evArr: Event[] = []
    var evGeojsonArr: any[] = []

    const { data } = await axios.post(
      API_FETCH_URL,
      querystring.stringify({
        limit: 200,
        delay: 0}
      ),
      FORM_ENCODE_CONFIG
    )

    if (! ('main' in data)) {
      throw new Error('Invalid response from fetch backend')
    }

    for (let i = 0; i < data.main.length; i++) {
      const entry = data.main[i]
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
  },

  async login ({ commit }, { username, password }: any) {
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

  async session ({ commit }) {
    const { data } = await axios.post(API_SESSION_URL)
    if ('status' in data
      && 'user' in data
      && data.status == 'success') {
      commit('SET_USER', data.user)
    } else {
      commit('SET_USER', null)
    }
  },

  async logout ({ commit }) {
    const user = this.getters.authUser

    if (!('username' in user) || !user.username) {
      throw new Error('You are not logged in')
    }

    const username = user.username
    const requestBody = {
      username: username
    }
    const { data } = await axios.post(
      API_SIGNOUT_URL,
      querystring.stringify(requestBody),
      FORM_ENCODE_CONFIG
    )
    if ('status' in data && data.status == 'success') {
      commit('SET_USER', null)
    } else {
      throw new Error('Logout was not succesfull')
    }
  }
}
