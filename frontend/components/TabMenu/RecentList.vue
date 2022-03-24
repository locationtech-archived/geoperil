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
  <v-list
    id="recent-list"
    class="ma-0 pa-0"
  >
    <v-list-item v-if="!recentEvents || recentEvents.length == 0">
      <em>There are no recent events.</em>
    </v-list-item>
    <EventItem
      v-for="(item, index) in recentEvents"
      v-show="eventMatchesFilter(item)"
      :key="index"
      :data="item"
      @change-to-compose-tab="handleChangeComposeTab"
    />
  </v-list>
</template>

<script lang="ts">
import { Vue, Component, Prop } from 'nuxt-property-decorator'
import EventItem from './EventItem.vue'
import { Event, EventFiltering } from '~/types'

@Component({
  components: {
    EventItem,
  },
})
export default class RecentList extends Vue {
  @Prop({ type: Object, default: null }) filter: EventFiltering|null = null

  get recentEvents (): Event[] {
    return this.$store.getters.recentEvents
  }

  public handleChangeComposeTab (): void {
    this.$emit('change-to-compose-tab')
  }

  public eventMatchesFilter (ev: Event): boolean {
    if (!this.filter) {
      return true
    }

    if (
      ev.mag && (
        this.filter.min > ev.mag ||
        this.filter.max < ev.mag
      )
    ) {
      return false
    }

    if (this.filter.mt && !ev.dip && !ev.strike && !ev.rake) {
      return false
    }

    if (this.filter.sea && !ev.seaArea) {
      return false
    }

    if (this.filter.sim && !ev.progress) {
      return false
    }

    return true
  }
}
</script>

<style>
#recent-list {
  height: calc(100vh - 50px - 48px - 60px);
  overflow-y: auto;
}
</style>
