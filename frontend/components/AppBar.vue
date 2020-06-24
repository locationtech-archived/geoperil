<template>
  <v-app-bar
    fixed
    app
  >
    <v-toolbar-title>GeoPeril</v-toolbar-title>
    <v-spacer></v-spacer>
    <SettingsButton v-if="$store.state.authUser" />
    <LogoutButton v-if="$store.state.authUser" />
  </v-app-bar>
</template>

<script lang="ts">
import { Vue, Component } from 'nuxt-property-decorator'
import LogoutButton from './LogoutButton.vue'
import SettingsButton from './SettingsButton.vue';

@Component({
  components: {
    LogoutButton,
    SettingsButton
  }
})
export default class AppBar extends Vue {

}
</script>
