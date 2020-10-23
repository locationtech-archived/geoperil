<template>
  <v-tooltip
    bottom
  >
    <template v-slot:activator="{ on, attrs }">
      <v-btn
        icon
        v-bind="attrs"
        v-on="on"
        @click.native="showSettings"
      >
        <v-icon>mdi-cog</v-icon>
      </v-btn>
    </template>
    <span>Settings</span>
  </v-tooltip>
</template>

<script lang="ts">
import { Vue, Component } from 'nuxt-property-decorator'

@Component
export default class SettingsButton extends Vue {
  public showSettings () {
    this.$store.commit('SET_SHOWSETTINGSDIALOG', true)
  }
}
</script>
