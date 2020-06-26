<template>
  <vl-map
    :load-tiles-while-animating="true"
    :load-tiles-while-interacting="true"
    id="geoperil-map"
  >
    <vl-view
      :zoom.sync="zoom"
      :min-zoom="minZoom"
      :max-zoom="maxZoom"
      :center.sync="center"
      :rotation.sync="rotation">
    </vl-view>

    <vl-layer-tile id="osm">
      <vl-source-osm></vl-source-osm>
    </vl-layer-tile>
  </vl-map>
</template>

<script lang="ts">
import { Vue, Component } from 'nuxt-property-decorator'

@Component
export default class Map extends Vue {
  private zoom: Number = 2
  private maxZoom: Number = 12
  private minZoom: Number = 2
  private center: Number[] = [0, 0]
  private rotation: Number = 0
}
</script>

<style>
#geoperil-map {
  height: 100%;
}

.ol-attribution.ol-uncollapsible {
  line-height: 0;
}

.v-application ul {
  padding-left: 5px;
}
</style>
