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
        <LoginForm v-if="!isLoggedIn">
        </LoginForm>
        <Geoperil v-else>
        </Geoperil>
        <SettingsDialog v-if="isLoggedIn && showSettings" />
        <StationDialog v-if="isLoggedIn && showStationDialog" />
        <PluginsDialogs />
      </v-container>
    </v-main>
  </v-app>
</template>

<script lang="ts">
import LoginForm from '../components/LoginForm.vue'
import AppBar from '../components/AppBar.vue'
import Geoperil from '../components/Geoperil.vue'
import { Vue, Component } from 'nuxt-property-decorator'
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
  }
})
export default class Index extends Vue {
  mounted() {
    this.$store.dispatch('getSupportedPlugins')
  }

  get isLoggedIn() {
    return !!this.$store.getters.user
  }

  get showSettings() {
    return this.$store.getters.showSettingsDialog
  }

  get showStationDialog() {
    return !!this.$store.getters.selectedStationDetail
  }
}
</script>

<style>
#main-container {
  height: calc(100vh - 50px);
}
</style>
