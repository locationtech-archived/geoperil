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
    <DialogRow>
      <StationDetails />
    </DialogRow>
  </v-dialog>
</template>

<script lang="ts">
import { Vue, Component } from 'nuxt-property-decorator'
import DialogToolbar from './DialogToolbar.vue'
import StationDetails from './StationDetails.vue'
import DialogRow from './DialogRow.vue'

@Component({
  components: {
    DialogToolbar,
    StationDetails,
    DialogRow,
  },
})
export default class StationDialog extends Vue {
  private dialog = true

  public closeDialog () {
    this.$store.commit('SET_SELECTED_STATION_DETAIL', null)
  }
}
</script>
