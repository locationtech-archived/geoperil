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
import DialogToolbar from './DialogToolbar.vue'
import TabItem from './TabItem.vue'
import UserSettings from './UserSettings.vue'
import StationSettings from './StationSettings.vue'
import UserManagement from './UserManagement.vue'
import PluginsSettingsTabs from './PluginsSettingsTabs.vue'
import PluginsSettingsTabsContent from './PluginsSettingsTabsContent.vue'

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
