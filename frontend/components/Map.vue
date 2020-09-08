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
      ref="layerWavejets"
      render-mode="image"
      :z-index="5"
    >
      <vl-source-vector ref="sourceWavejets" />
      <vl-style-func :factory="wavejetsStyleFunc" />
    </vl-layer-vector>

    <vl-layer-vector
      ref="layerArrivaltimes"
      render-mode="image"
      :z-index="6"
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
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import Feature from 'ol/Feature'
import LineString from 'ol/geom/LineString'
import MultiPolygon from 'ol/geom/MultiPolygon'

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

  get resultWavejets(): Array<any> {
    const res = this.$store.getters.resultWavejets
    if (res && 'features' in res) {
      return res.features
    }
    return []
  }

  get resultArrivaltimes(): Array<any> {
    const res = this.$store.getters.resultArrivaltimes
    if (res && 'features' in res) {
      return res.features
    }
    return []
  }

  @Watch('resultArrivaltimes')
  public onArrivaltimesChange(newValue: Array<any> | null) {
    this.$nextTick(function () {
      this.$store.commit('SET_MAP_IS_LOADING', false)
    })

    const sourceRef: any = this.$refs.sourceArrivaltimes
    const source: VectorSource = sourceRef.$source
    const layerRef: any = this.$refs.layerArrivaltimes
    const layer: VectorLayer = layerRef.$layer
    const sourceWaveRef: any = this.$refs.sourceWavejets
    const sourceWave: VectorSource = sourceWaveRef.$source
    const layerWaveRef: any = this.$refs.layerWavejets
    const layerWave: VectorLayer = layerWaveRef.$layer

    source.clear()
    sourceWave.clear()

    if (!newValue || newValue.length == 0) {
      return
    }

    const features: Feature[] = newValue.map(f => {
      const line = new LineString(f.geometry.coordinates)
      line.transform('EPSG:4326', 'EPSG:3857')
      const newFeature = new Feature({
        geometry: line,
      })
      newFeature.setProperties(f.properties)
      return newFeature
    })
    source.addFeatures(features)

    const wavejets = this.resultWavejets
    if (!wavejets || wavejets.length <= 1) {
      // length = 1 -> we got only the bbox
      return
    }

    const featuresWave: Feature[] = wavejets.map(f => {
      const poly = new MultiPolygon(f.geometry.coordinates)
      poly.transform('EPSG:4326', 'EPSG:3857')
      const newFeature = new Feature({
        geometry: poly,
      })
      newFeature.setProperties(f.properties)
      return newFeature
    })
    sourceWave.addFeatures(featuresWave)
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

  public wavejetsStyleFunc(): any {
    return (feature: any) => {
      const wavemin = feature.get('wavemin')
      const wavemax = feature.get('wavemax')
      var color = 'rgb(0,0,0)'

      if (wavemax < 0.3) {
        // skip first interval
        return []
      } else if (wavemax == 0.3) {
        color = '#fdfd01'
      } else if (wavemax == 0.5) {
        color = '#ff6100'
      } else if (wavemax == 1.0) {
        color = '#f50000'
      } else if (wavemax == 2.0) {
        color = '#ad0000'
      } else if (wavemax == 5.0) {
        color = '#fe00fa'
      } else if (wavemax == 10.0) {
        color = '#5c005c'
      }

      let style = new Style({
        /*stroke: new Stroke({
          color: '#4271A7'
        }),*/
        fill: new Fill({
          color: color,
        }),
      })
      return [ style ]
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
