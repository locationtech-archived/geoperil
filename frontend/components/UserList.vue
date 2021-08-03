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
    id="user-list"
    class="ma-0 pa-0"
  >
    <v-list-item v-if="!userEvents || userEvents.length == 0">
      <em>There are no items in your list.</em>
    </v-list-item>
    <EventItem
      v-for="(item, index) in userEvents"
      :key="index"
      :data="item"
      @change-to-compose-tab="handleChangeComposeTab"
    />
  </v-list>
</template>

<script lang="ts">
import { Vue, Component } from 'nuxt-property-decorator'
import { Event } from '../types'
import EventItem from './EventItem.vue'

@Component({
  components: {
    EventItem,
  },
})
export default class UserList extends Vue {
  get userEvents (): Event[] {
    return this.$store.getters.userEvents
  }

  public handleChangeComposeTab (): void {
    this.$emit('change-to-compose-tab')
  }
}
</script>

<style>
#user-list {
  height: 100%;
  overflow-y: auto;
}
</style>
