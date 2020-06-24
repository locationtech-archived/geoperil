<template>
  <v-tooltip
    bottom
  >
    <template v-slot:activator="{ on, attrs }">
      <v-btn
        icon
        v-bind="attrs"
        v-on="on"
        @click.native="logout"
      >
        <v-icon>mdi-login</v-icon>
      </v-btn>
    </template>
    <span>Logout</span>
  </v-tooltip>
</template>

<script lang="ts">
import { Vue, Component } from 'nuxt-property-decorator'

@Component
export default class LogoutButton extends Vue {
  public async logout() {
    try {
      await this.$store.dispatch('logout')
    } catch (e) {
      // TODO ?
    }
  }
}
</script>
