<template>
  <v-app-bar
    height="50px"
    fixed
    app
  >
    <v-toolbar-title>GeoPeril</v-toolbar-title>
    <v-spacer></v-spacer>
    <span v-if="$store.state.authUser">{{ $store.state.authUser.username }}</span>
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
