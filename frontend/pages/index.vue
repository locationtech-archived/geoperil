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
  <v-app>
    <AppBar />
    <v-main>
      <v-container
        id="main-container"
        class="ma-0 pa-0"
        align-center
        fluid
      >
        <LoginForm v-if="!isLoggedIn" />
        <Geoperil v-else />
        <SettingsDialog v-if="isLoggedIn && showSettings" />
        <StationDialog v-if="isLoggedIn && showStationDialog" />
        <PluginsDialogs />
      </v-container>
    </v-main>
  </v-app>
</template>

<script lang="ts">
import { Vue, Component } from 'nuxt-property-decorator'
import LoginForm from '../components/LoginForm.vue'
import AppBar from '../components/AppBar.vue'
import Geoperil from '../components/Geoperil.vue'
import SettingsDialog from '../components/SettingsDialog.vue'
import StationDialog from '../components/StationDialog.vue'
import PluginsDialogs from '../components/PluginsDialogs.vue'

@Component({
  components: {
    Geoperil,
    AppBar,
    LoginForm,
    SettingsDialog,
    StationDialog,
    PluginsDialogs,
  },
})
export default class Index extends Vue {
  mounted () {
    this.$store.dispatch('getSupportedPlugins')
  }

  get isLoggedIn () {
    return !!this.$store.getters.user
  }

  get showSettings () {
    return this.$store.getters.showSettingsDialog
  }

  get showStationDialog () {
    return !!this.$store.getters.selectedStationDetail
  }
}
</script>

<style>
#main-container {
  height: calc(100vh - 50px);
}
</style>
