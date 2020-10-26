<template>
  <!--
    Add your settings tab for plugins here
    Note: the tabs defined here have to correspond with the content in
    PluginsSettingsTabsContent
  -->
  <div class="plugins-settings-tabs-container">
    <!--
    <v-tab class="no-text-transform">
      Title of settings tab
    </v-tab>
    -->
  </div>
</template>

<script lang="ts">
import { Vue, Component } from 'nuxt-property-decorator'

@Component
export default class PluginsSettingsTabs extends Vue {
}
</script>

<style>
.plugins-settings-tabs-container {
  display: flex;
}
</style>
