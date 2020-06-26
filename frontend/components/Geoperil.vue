<template>
  <v-container
    class="ma-0 pa-0"
    fluid
    fill-height
  >
    <v-row
      no-gutters
      class="fill-height"
    >
      <v-col
        cols="3"
        class="fill-height"
      >
        <LeftMenu />
      </v-col>
      <v-col
        cols="9"
        class="fill-height"
      >
        <Map />
      </v-col>
    </v-row>
  </v-container>
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
