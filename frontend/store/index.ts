import { GetterTree, ActionTree, MutationTree } from 'vuex'
import axios from 'axios'
import querystring from 'querystring'

export const API_SIGNIN_URL = process.env.apiUrl + 'signin'
export const API_SESSION_URL = process.env.apiUrl + 'session'
export const API_SIGNOUT_URL = process.env.apiUrl + 'signout'
export const FORM_ENCODE_CONFIG = {
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded'
  }
}

export const state: any = () => ({
  authUser: null
})

export type RootState = ReturnType<typeof state>

export const getters: GetterTree<RootState, RootState> = {
  user: state => state.authUser
}

export const mutations: MutationTree<RootState> = {
  SET_USER: (state, user: any) => ( state.authUser = user )
}

export const actions: ActionTree<RootState, RootState> = {
  // nuxtServerInit is called by Nuxt.js before server-rendering every page
  nuxtServerInit ({ commit }, { req }) {
    if (req.session && req.session.authUser) {
      commit('SET_USER', req.session.authUser)
    }
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
    const user = this.getters.user

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
