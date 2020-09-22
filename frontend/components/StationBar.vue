<template>
  <v-row
    id="stationsrow"
    no-gutters
  >
    <v-sheet id="station-sheet" class="mx-auto">
      <v-slide-group multiple show-arrows>
        <v-slide-item v-if="selectedStations.length == 0">
          <em>No stations selected.</em>
        </v-slide-item>
        <v-slide-item
          class="station-item"
          v-for="station in selectedStations"
          :key="station.id"
        >
          <StationPreview :station="station" />
        </v-slide-item>
      </v-slide-group>
    </v-sheet>
  </v-row>
</template>

<script lang="ts">
import { Vue, Component } from 'nuxt-property-decorator'
import { Station } from '../types'
import StationPreview from './StationPreview.vue'

@Component({
  components: {
    StationPreview
  }
})
export default class StationBar extends Vue {
  get selectedStations(): Station[] {
    return this.$store.getters.selectedStations
  }
}
</script>

<style>
.station-item {
  width: 200px;
}

#stationsrow {
  height: 140px;
  line-height: 140px;
}

#station-sheet {
  max-width: 100%;
  display: flex;
  pointer-events: all;
}
</style>
