<template>
  <v-app-bar
    height="50px"
    fixed
    app
  >
    <v-toolbar-title>GeoPeril</v-toolbar-title>
    <v-spacer></v-spacer>
    <span id="username-bar" v-if="$store.state.user">{{ $store.state.user.username }}</span>
    <SettingsButton v-if="$store.state.user" />
    <LogoutButton v-if="$store.state.user" />
  </v-app-bar>
</template>

<script lang="ts">
import { Vue, Component } from 'nuxt-property-decorator'
import LogoutButton from './LogoutButton.vue'
import SettingsButton from './SettingsButton.vue'

@Component({
  components: {
    LogoutButton,
    SettingsButton
  }
})
export default class AppBar extends Vue {

}
</script>

<style>
span#username-bar {
  margin-right: 10px;
}
</style>
