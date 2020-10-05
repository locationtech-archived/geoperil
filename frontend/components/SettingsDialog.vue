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
      v-model="tab"
      id="settings-tabs"
      centered
    >
      <v-tab class="no-text-transform">General</v-tab>
      <v-tab class="no-text-transform">Stations</v-tab>

      <v-tabs-items
        class="fill-height-tabs"
        id="settings-tab-items"
        v-model="tab"
      >
        <v-row
          class="fill-height ma-0 pa-0"
          justify="center"
        >
          <v-col
            class="fill-height"
            cols="6"
          >
            <TabItem>
              <UserSettings />
            </TabItem>

            <TabItem>
              <StationSettings />
            </TabItem>
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

@Component({
  components: {
    TabItem,
    DialogToolbar,
    UserSettings,
    StationSettings
  }
})
export default class SettingsDialog extends Vue {
  private dialog = true
  private tab = null

  public closeDialog() {
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
