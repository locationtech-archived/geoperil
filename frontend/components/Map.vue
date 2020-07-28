<template>
  <vl-map
    :load-tiles-while-animating="true"
    :load-tiles-while-interacting="true"
    data-projection="EPSG:4326"
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
      <vl-source-osm />
    </vl-layer-tile>

    <vl-layer-vector
      render-mode="image"
      :visible="'identifier' in hovered"
    >
      <vl-source-vector>
        <vl-feature>
          <vl-geom-point
            :coordinates="[ hovered.lon, hovered.lat ]"
          />
          <vl-style-box>
            <vl-style-circle :radius="10">
              <vl-style-stroke color="red"></vl-style-stroke>
            </vl-style-circle>
          </vl-style-box>
        </vl-feature>
      </vl-source-vector>
    </vl-layer-vector>

    <vl-layer-vector
      render-mode="image"
      :visible="!('identifier' in hovered)"
    >
      <vl-source-vector :features="points">
        <vl-feature
          v-for="(item, index) in recentEvents"
          :key="index"
        >
          <vl-geom-point :coordinates="[ item.lon, item.lat ]" />
        </vl-feature>
      </vl-source-vector>
    </vl-layer-vector>
  </vl-map>
</template>

<script lang="ts">
import { Vue, Component, Watch } from 'nuxt-property-decorator'
import { Event } from '~/types'

@Component
export default class Map extends Vue {
  private zoom: Number = 2
  private maxZoom: Number = 12
  private minZoom: Number = 2
  private center: Number[] = [0, 0]
  private rotation: Number = 0

  get points(): any {
    return this.$store.getters.recentEventsGeojson
  }

  get hovered(): Event | null {
    // return dummy object so we don't need to use v-if
    return this.$store.getters.hoveredEvent || { lat: 0, lon: 0}
  }

  get recentEvents(): Event[] {
    return this.$store.getters.recentEvents
  }

  public isHovered(item: Event, hover: Event | null): boolean {
    if (!hover) {
      return false
    }

    if (item.identifier == hover.identifier) {
      return true
    }

    return false
  }
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
