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
      title="Sealevel Data"
    />
    <v-row
      id="station-dialog-row"
      class="fill-height ma-0 pa-0"
      justify="center"
    >
      <v-col
        class="fill-height"
      >
        <StationDetails />
      </v-col>
    </v-row>
  </v-dialog>
</template>

<script lang="ts">
import { Vue, Component, Prop } from 'nuxt-property-decorator'
import DialogToolbar from './DialogToolbar.vue'
import StationDetails from './StationDetails.vue'
import { Station } from '../types'

@Component({
  components: {
    DialogToolbar,
    StationDetails,
  }
})
export default class StationDialog extends Vue {
  private dialog = true

  public closeDialog() {
    this.$store.commit('SET_SELECTED_STATION_DETAIL', null)
  }
}
</script>

<style>
#station-dialog-row {
  height: calc(100vh - 50px);
  background-color: white;
}
</style>
