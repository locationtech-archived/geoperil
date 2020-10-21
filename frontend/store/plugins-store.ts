// add your actions and mutations for the plugins store here

import { GetterTree, ActionTree, MutationTree } from 'vuex'
import { PluginsState } from "~/types"

// do not use a function for this variable since it will be merged into the
// other vuex store object which is already contained within a function
export const pluginsState = {
  pluginvar: 'example',
}

export const pluginsGetters: GetterTree<PluginsState, PluginsState> = {
  pluginvar: (state: PluginsState) => state.pluginvar,
}

export const pluginsMutations: MutationTree<PluginsState> = {
  SET_PLUGINVAR: (state: PluginsState, value: any) => {
    state.pluginvar = value
  },
}

export const pluginsActions: ActionTree<PluginsState, PluginsState> = {
  exampleAction({ commit }: any) {
    // do something
  },
}
