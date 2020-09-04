<template>
  <vl-map
    :load-tiles-while-animating="true"
    :load-tiles-while-interacting="true"
    data-projection="EPSG:4326"
    id="geoperil-map"
  >
    <vl-view
      ref="view"
      :zoom.sync="zoom"
      :min-zoom="minZoom"
      :max-zoom="maxZoom"
      :center.sync="center"
      :rotation.sync="rotation">
    </vl-view>

    <vl-layer-tile id="osm" :z-index="1">
      <vl-source-osm />
    </vl-layer-tile>

    <vl-layer-vector
      render-mode="image"
      :visible="selectedTab == 0"
      :z-index="2"
    >
      <vl-source-vector :features="points" />
      <vl-style-func :factory="pointsStyleFunc" />
    </vl-layer-vector>

    <vl-layer-vector
      render-mode="image"
      :visible="selectedTab == 1"
      :z-index="2"
    >
      <vl-source-vector :features="pointsUser" />
      <vl-style-func :factory="pointsStyleFunc" />
    </vl-layer-vector>

    <vl-layer-vector
      render-mode="image"
      :visible="'identifier' in hovered"
      :z-index="3"
    >
      <vl-source-vector>
        <vl-feature>
          <vl-geom-point
            :coordinates="[ hovered.lon, hovered.lat ]"
          />
          <vl-style-box>
            <vl-style-circle :radius="10">
              <vl-style-stroke color="#4271A7"></vl-style-stroke>
            </vl-style-circle>
          </vl-style-box>
        </vl-feature>
      </vl-source-vector>
    </vl-layer-vector>

    <vl-layer-vector
      render-mode="image"
      :visible="'identifier' in selected"
      :z-index="4"
    >
      <vl-source-vector>
        <vl-feature>
          <vl-geom-point
            :coordinates="[ selected.lon, selected.lat ]"
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
      :z-index="5"
    >
      <vl-source-vector ref="sourceArrivaltimes" />
      <vl-style-box>
        <vl-style-stroke color="#4271A7"></vl-style-stroke>
      </vl-style-box>
    </vl-layer-vector>
  </vl-map>
</template>

<script lang="ts">
import { Vue, Component, Watch } from 'nuxt-property-decorator'
import { Event } from '~/types'
import { Style, Circle, Fill, Stroke } from 'ol/style.js'
import VectorSource from 'ol/source/Vector'
import Feature from 'ol/Feature'
import LineString from 'ol/geom/LineString'

@Component
export default class Map extends Vue {
  private zoom: Number = 2
  private maxZoom: Number = 12
  private minZoom: Number = 2
  private center: Number[] = [0, 0]
  private rotation: Number = 0

  get selectedTab(): Number {
    return this.$store.getters.selectedTab
  }

  get points(): any[] {
    return this.$store.getters.recentEventsGeojson
  }

  get pointsUser(): any[] {
    return this.$store.getters.userEventsGeojson
  }

  get mapIsLoading(): Boolean {
    return this.$store.getters.mapIsLoading
  }

  get selected(): Event {
    return this.$store.getters.selectedEvent || { lat: 0, lon: 0}
  }

  get resultArrivaltimes(): Array<any> | null {
    const res = this.$store.getters.resultArrivaltimes
    if (res && 'features' in res) {
      return res.features
    }
    return []
  }

  @Watch('resultArrivaltimes')
  public onArrivaltimesChange(newValue: Array<any> | null) {
    this.$store.commit('SET_MAP_IS_LOADING', true)

    const sourceRef: any = this.$refs.sourceArrivaltimes
    const source: VectorSource = sourceRef.$source

    if (source) {
      source.clear()
    }

    if (!newValue || newValue.length == 0) {
      return
    }

    const features = newValue.map(f => {
      const line = new LineString(f.geometry.coordinates)
      line.transform('EPSG:4326', 'EPSG:3857')
      return new Feature({
        geometry: line,
      })
    })

    source.addFeatures(features as Feature[])
  }

  @Watch('selected')
  public onSelectChange(newValue: Event | null) {
    if (!newValue || !('identifier' in newValue)) {
      return
    }

    const view: any = this.$refs.view

    view.animate({
      zoom: 6,
      center: [ newValue.lon, newValue.lat ]
    })
  }

  get hovered(): Event {
    // return dummy object so we don't need to use v-if
    return this.$store.getters.hoveredEvent || { lat: 0, lon: 0}
  }

  get recentEvents(): Event[] {
    return this.$store.getters.recentEvents
  }

  updated() {
    if (this.mapIsLoading) {
      this.$store.commit('SET_MAP_IS_LOADING', false)
    }
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

  public pointsStyleFunc(): any {
    return (feature: any) => {
      const mag = feature.get('mag')
      const depth = feature.get('depth')
      let radius = mag
      let depthFill = 'rgb(0,0,0)'

      if (depth>=0 && depth<=20) depthFill = 'rgb(255,0,0)' // red
      else if (depth>20 && depth<=50) depthFill = 'rgb(255,127,0)' // orange
      else if (depth>50 && depth<=100) depthFill = 'rgb(255,255,0)' // yellow
      else if (depth>100 && depth<=250) depthFill = 'rgb(0,255,0)' // green
      else if (depth>250 && depth<=500) depthFill = 'rgb(0,0,255)' // blue
      else if (depth>500 && depth<=800) depthFill = 'rgb(127,0,255)'; // violet

      let baseStyle = new Style({
        image: new Circle({
          radius: radius,
          stroke: new Stroke({
            color: '#4271A7'
          }),
          fill: new Fill({
            color: depthFill,
          }),
        }),
      })
      return [
        baseStyle,
      ]
    }
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
