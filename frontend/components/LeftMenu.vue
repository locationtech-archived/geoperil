<!--
GeoPeril - A platform for the computation and web-mapping of hazard specific
geospatial data, as well as for serving functionality to handle, share, and
communicate threat specific information in a collaborative environment.

Copyright (C) 2021 GFZ German Research Centre for Geosciences

SPDX-License-Identifier: Apache-2.0

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

  http://apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the Licence is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the Licence for the specific language governing permissions and
limitations under the Licence.

Contributors:
  Johannes Spazier (GFZ)
  Sven Reissland (GFZ)
  Martin Hammitzsch (GFZ)
  Matthias Rüster (GFZ)
  Hannes Fuchs (GFZ)
-->

<template>
  <v-tabs
    id="left-menu-tabs"
    v-model="tab"
    class="fill-height"
    grow
  >
    <v-tab class="no-text-transform" @click="changeTab(0)">
      Recent
    </v-tab>
    <v-tab class="no-text-transform" @click="changeTab(1)">
      My List
    </v-tab>
    <v-tab class="no-text-transform" @click="changeTab(2)">
      Compose
    </v-tab>

    <v-tabs-items
      v-model="tab"
      class="fill-height-tabs"
      :show-arrows="$vuetify.breakpoint.sm"
    >
      <TabItem>
        <RecentList
          @change-to-compose-tab="changeTab(2)"
        />
      </TabItem>

      <TabItem>
        <UserList
          @change-to-compose-tab="changeTab(2)"
        />
      </TabItem>

      <TabItem>
        <ComposeSimulation
          @change-to-mylist-tab="changeTab(1)"
        />
      </TabItem>
    </v-tabs-items>
  </v-tabs>
</template>

<script lang="ts">
import { Vue, Component } from 'nuxt-property-decorator'
import TabItem from './TabItem.vue'
import RecentList from './RecentList.vue'
import UserList from './UserList.vue'
import ComposeSimulation from './ComposeSimulation.vue'

@Component({
  components: {
    TabItem,
    RecentList,
    UserList,
    ComposeSimulation,
  },
})
export default class LeftMenu extends Vue {
  private tab: any = null

  public changeTab (which: number) {
    if (which === this.tab) {
      // nothing to do
      return
    }

    this.tab = which
    this.$store.commit('SET_SELECTED_TAB', which)
    this.$store.commit('SET_SELECTED_EVENT', null)
    this.$store.commit('SET_RESULT_ARRIVALTIMES', null)
  }

  get composeEvent (): Event | null {
    return this.$store.getters.composeEvent
  }
}
</script>

<style>
.no-text-transform {
  text-transform: none !important;
}

.fill-height-tabs {
  height: calc(100% - 48px);
}

/* needed for height of v-window__container */
.fill-height-tabs > div {
  height: 100%;
}

#left-menu-tabs .v-slide-group__prev,
#left-menu-tabs .v-slide-group__next {
  display: none !important;
}
</style>
