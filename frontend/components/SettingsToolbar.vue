<template>
  <v-toolbar
    color="#f5f5f5"
    height="50px"
    dense
  >
    <v-toolbar-title>GeoPeril - Settings</v-toolbar-title>
    <v-spacer></v-spacer>
    <v-tooltip bottom>
      <template v-slot:activator="{ on, attrs }">
        <v-btn
          icon
          v-bind="attrs"
          v-on="on"
          class="mr-9"
          @click.native="close"
        >
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </template>
      <span>Close</span>
    </v-tooltip>
  </v-toolbar>
</template>

<script lang="ts">
import { Vue, Component } from 'nuxt-property-decorator'

@Component({})
export default class SettingsDialog extends Vue {
  public close() {
    this.$store.commit('SET_SHOWSETTINGSDIALOG', false)
  }
}
</script>
