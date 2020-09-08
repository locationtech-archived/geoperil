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
      <Map />
    </v-col>
  </v-row>
</template>

<script lang="ts">
import { Vue, Component } from 'nuxt-property-decorator'
import Map from './Map.vue'
import LeftMenu from './LeftMenu.vue'
import LoadingOverlay from './LoadingOverlay.vue'

@Component({
  components: {
    LoadingOverlay,
    LeftMenu,
    Map
  }
})
export default class Geoperil extends Vue {
  private isLoading: boolean = true

  get mapIsLoading(): Boolean {
    return this.$store.getters.mapIsLoading
  }

  async mounted() {
    this.$store.dispatch('registerUpdater')
    await this.$store.dispatch('fetchEvents')
    this.isLoading = false
  }
}
</script>

<style>
#map-col {
  line-height: 0;
}
</style>
