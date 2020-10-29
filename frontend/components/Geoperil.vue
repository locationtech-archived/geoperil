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
      id="map-col"
      class="fill-height"
      cols="9"
    >
      <LoadingOverlay :is-loading="mapIsLoading" />
      <v-row
        id="maprow"
        :class="[ showStations ? 'show-stations-height' : 'fill-height' ]"
        no-gutters
      >
        <Map :size-changed="sizeChanged" />
        <v-btn
          id="toggle-stations-btn"
          class="ma-0 pa-0"
          :elevation="1"
          small
          @click="toggleShowStations"
        >
          <v-icon>{{ toggleButtonIcon }}</v-icon>
        </v-btn>
      </v-row>
      <StationBar v-show="showStations" />
    </v-col>
  </v-row>
</template>

<script lang="ts">
import { Vue, Component, Watch } from 'nuxt-property-decorator'
import { Station } from '../types'
import Map from './Map.vue'
import LeftMenu from './LeftMenu.vue'
import LoadingOverlay from './LoadingOverlay.vue'
import StationBar from './StationBar.vue'

@Component({
  components: {
    LoadingOverlay,
    LeftMenu,
    Map,
    StationBar,
  },
})
export default class Geoperil extends Vue {
  private isLoading: boolean = true
  private showStations: boolean = true
  private sizeChanged: number = 0

  get toggleButtonIcon (): string {
    return this.showStations
      ? 'mdi-chevron-double-down'
      : 'mdi-chevron-double-up'
  }

  get mapIsLoading (): boolean {
    return this.$store.getters.mapIsLoading
  }

  public toggleShowStations (): void {
    this.showStations = !this.showStations
  }

  @Watch('showStations')
  public onShowStationsChange () {
    this.sizeChanged = this.sizeChanged + 1
  }

  get selectedStations (): Station[] {
    return this.$store.getters.selectedStations
  }

  @Watch('selectedStations')
  public onSelectedStationsChange (newValue: Station[], oldValue: Station[]) {
    if (oldValue === newValue) {
      return
    }

    if (
      (!oldValue || oldValue.length === 0) &&
      newValue &&
      newValue.length > 0
    ) {
      this.showStations = true
    }

    if (!newValue || newValue.length === 0) {
      this.showStations = false
    }
  }

  async mounted () {
    await this.$store.dispatch('registerUpdater')
    await this.$store.dispatch('fetchEvents')
    await this.$store.dispatch('fetchStations')
    await this.$store.dispatch('fetchAllInstitutions')
    await this.$store.dispatch('initPlugins')
    this.isLoading = false

    if (this.$store.getters.selectedStations.length === 0) {
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
