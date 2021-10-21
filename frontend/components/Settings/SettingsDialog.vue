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
  <v-dialog
    v-model="dialog"
    :transition="false"
    fullscreen
    hide-overlay
    persistent
  >
    <DialogToolbar
      :close-action="closeDialog"
      title="Settings"
    />
    <v-tabs
      id="settings-tabs"
      v-model="tab"
      centered
    >
      <v-tab class="no-text-transform">
        General
      </v-tab>
      <v-tab class="no-text-transform">
        Stations
      </v-tab>
      <v-tab v-if="isAdmin" class="no-text-transform">
        Users
      </v-tab>
      <PluginsSettingsTabs />

      <v-tabs-items
        id="settings-tab-items"
        v-model="tab"
        class="fill-height-tabs"
      >
        <v-row
          class="fill-height ma-0 pa-0"
          justify="center"
        >
          <v-col
            class="fill-height"
            cols="8"
          >
            <TabItem>
              <UserSettings />
            </TabItem>

            <TabItem>
              <StationSettings />
            </TabItem>

            <TabItem v-if="isAdmin">
              <UserManagement />
            </TabItem>

            <PluginsSettingsTabsContent />
          </v-col>
        </v-row>
      </v-tabs-items>
    </v-tabs>
  </v-dialog>
</template>

<script lang="ts">
import { Vue, Component } from 'nuxt-property-decorator'
import DialogToolbar from '~/components/Utils/DialogToolbar.vue'
import TabItem from '~/components/Utils/TabItem.vue'
import UserSettings from '~/components/Settings/UserSettings.vue'
import StationSettings from '~/components/Settings/StationSettings.vue'
import UserManagement from '~/components/Settings/UserManagement.vue'
import PluginsSettingsTabs from '~/components/Settings/PluginsSettingsTabs.vue'
import PluginsSettingsTabsContent from '~/components/Settings/PluginsSettingsTabsContent.vue'

@Component({
  components: {
    TabItem,
    DialogToolbar,
    UserSettings,
    StationSettings,
    UserManagement,
    PluginsSettingsTabs,
    PluginsSettingsTabsContent,
  },
})
export default class SettingsDialog extends Vue {
  private dialog = true
  private tab = null

  get isAdmin (): boolean {
    return this.$store.getters.isAdmin
  }

  public closeDialog () {
    this.$store.commit('SET_SHOWSETTINGSDIALOG', false)
  }
}
</script>

<style>
#settings-tabs {
  height: calc(100vh - 50px);
}

#settings-tab-items {
  overflow-y: auto;
}
</style>
