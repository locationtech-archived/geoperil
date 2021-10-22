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
    <v-tab class="no-text-transform pr-1 pl-1" @click="changeTab(0)">
      Events
    </v-tab>
    <v-tab class="no-text-transform pr-1 pl-1" @click="changeTab(1)">
      Computations
    </v-tab>
    <v-tab class="no-text-transform pr-1 pl-1" @click="changeTab(2)">
      Compute
    </v-tab>

    <v-tabs-items
      v-model="tab"
      :class="tabListClass"
      :show-arrows="$vuetify.breakpoint.mdAndDown"
    >
      <TabItem>
        <EventFilter :filter.sync="filter" />
        <v-divider />
        <RecentList
          :filter="filterRecent"
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
import { Vue, Component, Watch } from 'nuxt-property-decorator'
import RecentList from './RecentList.vue'
import UserList from './UserList.vue'
import ComposeSimulation from './ComposeSimulation.vue'
import EventFilter from './EventFilter.vue'
import TabItem from '~/components/Utils/TabItem.vue'
import { EventFiltering } from '~/types'

@Component({
  components: {
    TabItem,
    RecentList,
    UserList,
    ComposeSimulation,
    EventFilter,
  },
})
export default class TabMenu extends Vue {
  private tab: any = null
  private filterRecent: EventFiltering|null = null
  private filter: EventFiltering = {
    min: 0,
    max: 10,
    mt: false,
    sea: false,
    sim: false,
  } as EventFiltering

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

  get tabListClass (): string {
    let extraClass = ''

    if (this.tab === 0) {
      extraClass = ' with-filtering'
    }

    return 'fill-height-tabs' + extraClass
  }

  @Watch('filter', { deep: true })
  public onFilterChange () {
    // with this we avoid changing the property of RecentList directly
    // could also be done by emitting events from the EventFilter component
    this.filterRecent = this.filter
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

.with-filtering {
  height: calc(100% - 109px) !important;
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
