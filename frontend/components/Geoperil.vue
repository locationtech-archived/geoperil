<template>
  <v-row
    v-if="!isLoading"
    class="fill-height"
    no-gutters
  >
    <v-col
      class="fill-height"
      cols="3"
    >
      <LeftMenu />
    </v-col>
    <v-col
      class="fill-height"
      id="map-col"
      cols="9"
    >
      <LoadingOverlay :isLoading="mapIsLoading" />
      <v-row
        id="maprow"
        :class="[ showStations ? 'show-stations-height' : 'fill-height' ]"
        no-gutters
      >
        <Map :size-changed="sizeChanged"/>
        <v-btn
          id="toggle-stations-btn"
          class="ma-0 pa-0"
          :elevation="1"
          @click="toggleShowStations"
          small
        >
          <v-icon>{{ toggleButtonIcon }}</v-icon>
        </v-btn>
      </v-row>
      <StationBar v-if="showStations" />
    </v-col>
  </v-row>
</template>

<script lang="ts">
import { Vue, Component } from 'nuxt-property-decorator'
import Map from './Map.vue'
import LeftMenu from './LeftMenu.vue'
import LoadingOverlay from './LoadingOverlay.vue'
import StationBar from './StationBar.vue'

@Component({
  components: {
    LoadingOverlay,
    LeftMenu,
    Map,
    StationBar
  }
})
export default class Geoperil extends Vue {
  private isLoading: boolean = true
  private showStations: boolean = true
  private sizeChanged: number = 0

  get toggleButtonIcon(): string {
    return this.showStations
      ? 'mdi-chevron-double-down'
      : 'mdi-chevron-double-up'
  }

  get mapIsLoading(): Boolean {
    return this.$store.getters.mapIsLoading
  }

  public toggleShowStations() {
    this.showStations = !this.showStations
    this.sizeChanged = this.sizeChanged + 1
  }

  async mounted() {
    await this.$store.dispatch('registerUpdater')
    await this.$store.dispatch('fetchEvents')
    await this.$store.dispatch('fetchStations')
    this.isLoading = false

    if (this.$store.getters.selectedStations.length == 0) {
      this.showStations = false
    }
  }
}
</script>

<style>
#map-col {
  line-height: 0;
}

#toggle-stations-btn {
  min-width: 0;
  height: 32px;
  width: 32px;
  position: relative;
  left: 5px;
  top: -38px;
}

.show-stations-height {
  height: calc(100vh - 50px - 140px);
}
</style>
