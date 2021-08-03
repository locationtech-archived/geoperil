<!--
GeoPeril - A platform for the computation and web-mapping of hazard specific
geospatial data, as well as for serving functionality to handle, share, and
communicate threat specific information in a collaborative environment.

Copyright (C) 2021 GFZ German Research Centre for Geosciences

SPDX-License-Identifier: Apache-2.0

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

  http://apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the Licence is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the Licence for the specific language governing permissions and
limitations under the Licence.

Contributors:
  Johannes Spazier (GFZ)
  Sven Reissland (GFZ)
  Martin Hammitzsch (GFZ)
  Matthias Rüster (GFZ)
  Hannes Fuchs (GFZ)
-->

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
          v-for="station in selectedStations"
          :key="station.id"
          class="station-item"
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
    StationPreview,
  },
})
export default class StationBar extends Vue {
  private previewWidth = 200

  get selectedStationMap (): Station | null {
    return this.$store.getters.selectedStationMap
  }

  get stationHoveredMap (): string | null {
    return this.$store.getters.stationHoveredMap
  }

  get selectedStations (): Station[] {
    return this.$store.getters.selectedStations
  }

  @Watch('selectedStationMap')
  public onStationSelectMapChange (newvalue: Station | null) {
    const slide: any = this.$refs.slide

    if (!slide || !newvalue || !('id' in newvalue)) {
      return
    }

    let i

    for (i = 0; i < this.selectedStations.length; i++) {
      const cur = this.selectedStations[i]
      if (cur.id === newvalue.id) {
        break
      }
    }

    slide.scrollOffset = i * this.previewWidth
  }

  @Watch('stationHoveredMap')
  public onStationHoveredMapChange (newvalue: string | null) {
    const slide: any = this.$refs.slide
    const selectedOnMap = this.$store.getters.selectedStationMap

    if (!slide || !newvalue || selectedOnMap) {
      return
    }

    let i

    for (i = 0; i < this.selectedStations.length; i++) {
      const cur = this.selectedStations[i]
      if (cur.id === newvalue) {
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
