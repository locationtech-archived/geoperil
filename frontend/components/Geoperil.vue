<template>
  <v-row
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
      <Map />
    </v-col>
  </v-row>
</template>

<script lang="ts">
import { Vue, Component } from 'nuxt-property-decorator'
import Map from './Map.vue'
import LeftMenu from './LeftMenu.vue';

@Component({
  components: {
    LeftMenu,
    Map
  }
})
export default class Geoperil extends Vue {
}
</script>

<style>
#map-col {
  line-height: 0;
}
</style>
