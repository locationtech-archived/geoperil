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
  async initPlugins({ commit }: any) {
    // initialize your plugins store here
    commit('SET_PLUGINVAR', 'init')
  },
}
