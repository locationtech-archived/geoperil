<template>
  <v-row
    id="stationsrow"
    no-gutters
  >
    <v-sheet id="station-sheet" class="mx-auto">
      <v-slide-group ref="slide" show-arrows>
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
import { Vue, Component, Watch } from 'nuxt-property-decorator'
import { Station } from '../types'
import StationPreview from './StationPreview.vue'

@Component({
  components: {
    StationPreview
  }
})
export default class StationBar extends Vue {
  private previewWidth = 200

  get selectedStationMap(): Station | null {
    return this.$store.getters.selectedStationMap
  }

  get stationHoveredMap(): string | null {
    return this.$store.getters.stationHoveredMap
  }

  get selectedStations(): Station[] {
    return this.$store.getters.selectedStations
  }

  @Watch('selectedStationMap')
  public onStationSelectMapChange(newvalue: Station | null) {
    const slide: any = this.$refs.slide

    if (!slide || !newvalue || !('id' in newvalue)) {
      return
    }

    var i

    for (i = 0; i < this.selectedStations.length; i++) {
      const cur = this.selectedStations[i]
      if (cur.id == newvalue.id) {
        break
      }
    }

    slide.scrollOffset = i * this.previewWidth
  }

  @Watch('stationHoveredMap')
  public onStationHoveredMapChange(newvalue: string | null) {
    const slide: any = this.$refs.slide
    const selectedOnMap = this.$store.getters.selectedStationMap

    if (!slide || !newvalue || selectedOnMap) {
      return
    }

    var i

    for (i = 0; i < this.selectedStations.length; i++) {
      const cur = this.selectedStations[i]
      if (cur.id == newvalue) {
        break
      }
    }

    slide.scrollOffset = i * this.previewWidth
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
