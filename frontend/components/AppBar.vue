<template>
  <v-app-bar
    height="50px"
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
