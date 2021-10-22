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
  <v-app-bar
    :height="height"
    fixed
    app
  >
    <v-toolbar-title>GeoPeril</v-toolbar-title>
    <v-spacer />
    <span v-if="user" id="username-bar">{{ user.username }}</span>
    <SettingsButton v-if="user" />
    <LogoutButton v-if="user" />
  </v-app-bar>
</template>

<script lang="ts">
import { Vue, Component } from 'nuxt-property-decorator'
import LogoutButton from './LogoutButton.vue'
import SettingsButton from './SettingsButton.vue'

@Component({
  components: {
    LogoutButton,
    SettingsButton,
  },
})
export default class AppBar extends Vue {
  get height () {
    if (!this.user) {
      return '100px'
    }

    return '50px'
  }

  get user () {
    return this.$store.getters.user
  }
}
</script>

<style>
span#username-bar {
  margin-right: 10px;
}
</style>
