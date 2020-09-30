<template>
  <vl-map
    :load-tiles-while-animating="true"
    :load-tiles-while-interacting="true"
    @rendercomplete="onRendercomplete"
    @pointermove="onMapPointerMove"
    ref="map"
    data-projection="EPSG:4326"
    id="geoperil-map"
  >
    <vl-interaction-select
      :features="selectedFeature"
      :layers="['arrivaltimesId', 'wavejetsId']"
      :hitTolerance="5"
    >
      <template slot-scope="select">
        <vl-overlay
          v-for="feature in select.features" :key="feature.id" :id="feature.id"
          :position="pointOnSurface(feature.geometry)"
          :auto-pan="true"
          :auto-pan-animation="{ duration: 300 }"
        >
          <template slot-scope="popup">
            <v-card
              v-if="featureHasProperty(feature, 'time')"
              class="pa-0"
            >
              <v-card-text class="pa-0 pl-2">
                <span class="mt-2">Arrival time: {{ feature.properties['time'] }} min</span>
                <v-btn
                  class="pa-0 pl-1 pr-2"
                  min-width="0"
                  height="16px"
                  @click="selectedFeature = []"
                  text
                >
                  <v-icon color="#154f8a" size="16">mdi-close</v-icon>
                </v-btn>
              </v-card-text>
            </v-card>
            <v-card
              v-if="featureHasProperty(feature, 'wavemin')"
              class="pa-0"
            >
              <v-card-text class="pa-0 pl-2">
                <span>Wave heights greater than {{ feature.properties['wavemin'] }} m</span>
                <v-btn
                  class="pa-0 pl-1 pr-2"
                  min-width="0"
                  height="16px"
                  @click="selectedFeature = []"
                  text
                >
                  <v-icon color="#154f8a" size="16">mdi-close</v-icon>
                </v-btn>
              </v-card-text>
            </v-card>
          </template>
        </vl-overlay>
      </template>
    </vl-interaction-select>

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
      :z-index="5"
    >
      <vl-source-vector :features="points" />
      <vl-style-func :factory="pointsStyleFunc" />
    </vl-layer-vector>

    <vl-layer-vector
      render-mode="image"
      :visible="selectedTab == 1"
      :z-index="5"
    >
      <vl-source-vector :features="pointsUser" />
      <vl-style-func :factory="pointsStyleFunc" />
    </vl-layer-vector>

    <vl-layer-vector
      render-mode="image"
      :visible="'identifier' in hovered"
      :z-index="6"
    >
      <vl-source-vector>
        <vl-feature>
          <vl-geom-point
            :coordinates="[ hovered.lon, hovered.lat ]"
          />
          <vl-style-box>
            <vl-style-circle :radius="12">
              <vl-style-stroke :width="3" color="#4271A7"></vl-style-stroke>
            </vl-style-circle>
          </vl-style-box>
        </vl-feature>
      </vl-source-vector>
    </vl-layer-vector>

    <vl-layer-vector
      render-mode="image"
      :visible="'identifier' in selected"
      :z-index="5"
    >
      <vl-source-vector>
        <vl-feature>
          <vl-geom-point
            :coordinates="[ selected.lon, selected.lat ]"
          />
          <vl-style-box>
            <vl-style-circle :radius="12">
              <vl-style-stroke :width="3" color="red"></vl-style-stroke>
            </vl-style-circle>
          </vl-style-box>
        </vl-feature>
      </vl-source-vector>
    </vl-layer-vector>

    <vl-layer-vector
      id="wavejetsId"
      render-mode="image"
      :z-index="2"
    >
      <vl-source-vector ref="sourceWavejets" />
      <vl-style-func :factory="wavejetsStyleFunc" />
    </vl-layer-vector>

    <vl-layer-vector
      id="arrivaltimesId"
      render-mode="image"
      :z-index="3"
    >
      <vl-source-vector ref="sourceArrivaltimes" />
      <vl-style-box>
        <vl-style-stroke color="#4271A7"></vl-style-stroke>
      </vl-style-box>
    </vl-layer-vector>

    <vl-layer-vector
      id="stationsId"
      render-mode="image"
      :z-index="4"
    >
      <vl-source-vector ref="sourceStations" />
      <vl-style-func :factory="stationsStyleFunc" />
    </vl-layer-vector>
  </vl-map>
</template>

<script lang="ts">
import { Vue, Component, Watch, Prop } from 'nuxt-property-decorator'
import { Event, User, Station } from '~/types'
import { findPointOnSurface } from 'vuelayers/lib/ol-ext'
import { Style, Circle, Fill, Stroke, RegularShape } from 'ol/style.js'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import Feature from 'ol/Feature'
import LineString from 'ol/geom/LineString'
import MultiPolygon from 'ol/geom/MultiPolygon'
import Point from 'ol/geom/Point'

@Component
export default class Map extends Vue {
  @Prop({ type: Number, required: false }) sizeChanged!: number
  private zoom: Number = 2
  private maxZoom: Number = 12
  private minZoom: Number = 2
  private center: Number[] = [0, 0]
  private rotation: Number = 0
  private selectedFeature: any[] = []
  private stationsRendered: boolean = false

  public onRendercomplete() {
    if (this.stationsRendered) {
      return
    }

    this.updateStations(this.$store.getters.selectedStations)
    this.stationsRendered = true
  }

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

  get selectedStations(): Station[] {
    return this.$store.getters.selectedStations
  }

  public updateStations(newValue: Station[]) {
    const sourceRef: any = this.$refs.sourceStations
    const source: VectorSource = sourceRef.$source

    if (!source) {
      return
    }

    source.clear()

    if (!newValue || newValue.length == 0) {
      return
    }

    const features: Feature[] = newValue.map((f: Station) => {
      const point = new Point([ f.lon, f.lat ])
      point.transform('EPSG:4326', 'EPSG:3857')

      const newFeature = new Feature({
        geometry: point,
      })

      if ('id' in f) {
        newFeature.setId(f.id)
      } else {
        console.warn('Got a station without ID')
        // random number
        newFeature.setId(Math.floor(Math.random() * 999999))
      }

      newFeature.setProperties({
        station: f.name
      })
      return newFeature
    })
    source.addFeatures(features)
  }

  @Watch('selectedStations')
  public onSelectedStationsChange(newValue: Station[]) {
    this.updateStations(newValue)
  }

  @Watch('sizeChanged')
  public onSizeChanged(newValue: number) {
    const map: any = this.$refs.map
    if (map) {
      map.updateSize()
    }
  }

  public featureHasProperty(feature: any, prop: string) {
    return feature
      && 'properties' in feature
      && feature.properties
      && prop in feature.properties
      && feature.properties[prop]
  }

  public pointOnSurface(g: any) {
    return findPointOnSurface(g)
  }

  @Watch('resultArrivaltimes')
  public onArrivaltimesChange(newValue: Array<any> | null) {
    this.$nextTick(function () {
      this.$store.commit('SET_MAP_IS_LOADING', false)
    })

    const sourceRef: any = this.$refs.sourceArrivaltimes
    const source: VectorSource = sourceRef.$source
    const sourceWaveRef: any = this.$refs.sourceWavejets
    const sourceWave: VectorSource = sourceWaveRef.$source

    source.clear()
    sourceWave.clear()
    this.selectedFeature = []

    if (!newValue || newValue.length == 0) {
      return
    }

    const features: Feature[] = newValue.map(f => {
      const line = new LineString(f.geometry.coordinates)
      line.transform('EPSG:4326', 'EPSG:3857')

      const newFeature = new Feature({
        geometry: line,
      })

      if ('ID' in f.properties) {
        newFeature.setId(f.properties['ID'])
      } else {
        // random number
        newFeature.setId(Math.floor(Math.random() * 999999))
      }

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

      if ('ID' in f.properties) {
        newFeature.setId(f.properties['ID'])
      } else {
        // random number
        newFeature.setId(Math.floor(Math.random() * 999999))
      }

      newFeature.setProperties(f.properties)
      return newFeature
    })
    sourceWave.addFeatures(featuresWave)
  }

  @Watch('selectedTab')
  public onSelectedTabChange(newValue: any) {
    this.selectedFeature = []
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

      if (wavemin == 0) {
        // skip first interval
        return []
      } else if (wavemin == 0.05) {
        color = '#2d9f33'
      } else if (wavemin == 0.3) {
        color = '#fdfd01'
      } else if (wavemin == 0.5) {
        color = '#ff6100'
      } else if (wavemin == 1.0) {
        color = '#f50000'
      } else if (wavemin == 2.0) {
        color = '#ad0000'
      } else if (wavemin == 5.0) {
        color = '#fe00fa'
      } else if (wavemin == 10.0) {
        color = '#5c005c'
      } else {
        return []
      }

      let style = new Style({
        fill: new Fill({
          color: color,
        }),
      })
      return [ style ]
    }
  }

  public stationsStyleFunc(): any {
    // TODO: set colors based on computation results

    return (feature: any) => {
      let style = new Style({
        image: new RegularShape({
          points: 3,
          radius: 6,
          fill: new Fill({
            color: '#A0A1A0',
          }),
          stroke: new Stroke({
            color: '#4271A7',
          }),
        } as any),
      })

      return [ style ]
    }
  }

  public onMapPointerMove({ pixel }: {pixel: number[]}) {
    const map: any = this.$refs.map
    let hit: Feature = map.forEachFeatureAtPixel(pixel, (f: Feature) => f)

    if (!hit) {
      this.$store.commit('SET_STATIONHOVEREDMAP', null)
      return
    }

    const props = hit.getProperties()

    if (!props) {
      return
    }

    if ('station' in props) {
      this.$store.commit('SET_STATIONHOVEREDMAP', hit.getId())
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
