<!--
GeoPeril - A platform for the computation and web-mapping of hazard specific
geospatial data, as well as for serving functionality to handle, share, and
communicate threat specific information in a collaborative environment.

Copyright (C) 2021 GFZ German Research Centre for Geosciences

SPDX-License-Identifier: Apache-2.0

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

  http://apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the Licence is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the Licence for the specific language governing permissions and
limitations under the Licence.

Contributors:
  Johannes Spazier (GFZ)
  Sven Reissland (GFZ)
  Martin Hammitzsch (GFZ)
  Matthias Rüster (GFZ)
  Hannes Fuchs (GFZ)
-->

<template>
  <vl-map
    id="geoperil-map"
    ref="map"
    :load-tiles-while-animating="true"
    :load-tiles-while-interacting="true"
    data-projection="EPSG:4326"
    @rendercomplete="onRendercomplete"
    @pointermove="onMapPointerMove"
  >
    <vl-interaction-select
      :features.sync="selectedFeatures"
      :layers="['arrivaltimesId', 'wavejetsId', 'stationsId', 'tfpsId']"
      :hit-tolerance="5"
    >
      <vl-style-func v-if="selectedStation" :factory="selectedStationStyleFunc" />
      <vl-style-func v-if="selectedTfp" :factory="selectedTfpStyleFunc" />
    </vl-interaction-select>

    <vl-overlay
      v-for="feature in selectedFeatures"
      :id="feature.id + '-popup'"
      :key="feature.id"
      :position="pointOnSurface(feature.geometry)"
      :auto-pan="true"
      :auto-pan-animation="{ duration: 300 }"
    >
      <template>
        <v-card
          v-if="featureHasProperty(feature, 'time')"
          class="pa-0"
        >
          <v-card-text class="pa-0 pl-2">
            <span class="mt-2">Arrival time: {{ feature.properties['time'] }} minutes</span>
            <v-btn
              class="pa-0 pl-1 pr-2"
              min-width="0"
              height="16px"
              text
              @click="selectedFeatures = []"
            >
              <v-icon color="#154f8a" size="16">
                mdi-close
              </v-icon>
            </v-btn>
          </v-card-text>
        </v-card>
        <v-card
          v-if="featureHasProperty(feature, 'wavemin')"
          class="pa-0"
        >
          <v-card-text class="pa-0 pl-2">
            <span>Wave heights greater than {{ feature.properties['wavemin'] }} meters</span>
            <v-btn
              class="pa-0 pl-1 pr-2"
              min-width="0"
              height="16px"
              text
              @click="selectedFeatures = []"
            >
              <v-icon color="#154f8a" size="16">
                mdi-close
              </v-icon>
            </v-btn>
          </v-card-text>
        </v-card>
        <v-card
          v-if="featureHasProperty(feature, 'ewh') && featureHasProperty(feature, 'eta')"
          class="pa-0"
        >
          <v-card-text class="pa-0 pl-2">
            <b>{{ feature.properties['tfp'] }}</b>
            <br>
            <span v-if="feature.properties['eta'] == -1">Not affected or not covered by computation.</span>
            <span v-else>Estimated wave height: {{ feature.properties['ewh'].toFixed(2) }} meters</span>
            <v-btn
              class="pa-0 pl-1 pr-2"
              min-width="0"
              height="16px"
              text
              @click="selectedFeatures = []"
            >
              <v-icon color="#154f8a" size="16">
                mdi-close
              </v-icon>
            </v-btn>
            <br>
            <span v-if="feature.properties['eta'] != -1">Estimated arrival time: {{ feature.properties['eta'].toFixed(1) }} minutes</span>
          </v-card-text>
        </v-card>
      </template>
    </vl-overlay>

    <vl-view
      ref="view"
      :zoom.sync="zoom"
      :min-zoom="minZoom"
      :max-zoom="maxZoom"
      :center.sync="center"
      :rotation.sync="rotation"
    />

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
      :visible="'identifier' in hoveredEvent"
      :z-index="6"
    >
      <vl-source-vector>
        <vl-feature>
          <vl-geom-point
            :coordinates="[ hoveredEvent.lon, hoveredEvent.lat ]"
          />
          <vl-style-box>
            <vl-style-circle :radius="12">
              <vl-style-stroke :width="3" color="#4271A7" />
            </vl-style-circle>
          </vl-style-box>
        </vl-feature>
      </vl-source-vector>
    </vl-layer-vector>

    <vl-layer-vector
      render-mode="image"
      :visible="'id' in hoveredStation && (!selectedStation || hoveredStation.id != selectedStation.id)"
      :z-index="6"
    >
      <vl-source-vector>
        <vl-feature>
          <vl-geom-point
            :coordinates="[ hoveredStation.lon, hoveredStation.lat ]"
          />
          <vl-style-func :factory="stationHoveredStyleFunc" />
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
              <vl-style-stroke :width="3" color="red" />
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
        <vl-style-stroke color="#4271A7" />
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

    <vl-layer-vector
      id="tfpsId"
      render-mode="image"
      :z-index="4"
    >
      <vl-source-vector ref="sourceTfps" />
      <vl-style-func :factory="tfpsStyleFunc" />
    </vl-layer-vector>
  </vl-map>
</template>

<script lang="ts">
import { Vue, Component, Watch, Prop } from 'nuxt-property-decorator'
import { findPointOnSurface } from 'vuelayers/lib/ol-ext'
import { Style, Circle, Fill, Stroke, RegularShape } from 'ol/style.js'
import VectorSource from 'ol/source/Vector'
import Feature from 'ol/Feature'
import LineString from 'ol/geom/LineString'
import MultiPolygon from 'ol/geom/MultiPolygon'
import Point from 'ol/geom/Point'
import {
  Event,
  Station,
  Tfp,
} from '~/types'

@Component
export default class Map extends Vue {
  @Prop({ type: Number, required: false }) sizeChanged!: number
  private zoom: Number = 2
  private maxZoom: Number = 12
  private minZoom: Number = 2
  private center: Number[] = [0, 0]
  private rotation: Number = 0
  private selectedFeatures: any[] = []
  private stationsRendered: boolean = false
  private selectedTfp: Tfp|null = null
  private stationFillColor: string = '#4169E1'
  private stationOutlineColor: string = '#000'

  public onRendercomplete () {
    if (this.stationsRendered) {
      return
    }

    this.updateStations(this.userStations)
    this.stationsRendered = true
  }

  get selectedTab (): Number {
    return this.$store.getters.selectedTab
  }

  get points (): any[] {
    return this.$store.getters.recentEventsGeojson
  }

  get pointsUser (): any[] {
    return this.$store.getters.userEventsGeojson
  }

  get mapIsLoading (): Boolean {
    return this.$store.getters.mapIsLoading
  }

  get selected (): Event {
    return this.$store.getters.selectedEvent || { lat: 0, lon: 0 }
  }

  get resultWavejets (): Array<any> {
    const res = this.$store.getters.resultWavejets
    if (res && 'features' in res) {
      return res.features
    }
    return []
  }

  get resultArrivaltimes (): Array<any> {
    const res = this.$store.getters.resultArrivaltimes
    if (res && 'features' in res) {
      return res.features
    }
    return []
  }

  @Watch('selectedFeatures')
  public onSelectedFeaturesChange (newValue: Feature[], oldValue: Feature[]) {
    if (newValue === oldValue) {
      return
    }

    // reset previously selected features
    this.$store.commit('SET_SELECTED_STATION_MAP', null)
    this.selectedTfp = null

    const ref: any = this.$refs.sourceStations
    const allStations: Station[] = this.$store.getters.allStations
    const allTfps: Tfp[] = this.$store.getters.tfps

    if (!ref || !allStations || allStations.length === 0) {
      return
    }

    const filtered: Feature[] = newValue.filter(
      (feature: Feature) => {
        return 'id' in feature
      }
    )

    if (filtered.length !== 1) {
      return
    }

    const filteredStation: Station[] = allStations.filter(
      (station: Station) => station.id === (filtered[0] as any).id
    )

    if (filteredStation.length === 1) {
      this.$store.commit('SET_SELECTED_STATION_MAP', filteredStation[0])
      // found the selected feature, we are done
      return
    }

    const filteredTfp: Tfp[] = allTfps.filter(
      (tfp: Tfp) => tfp.id === (filtered[0] as any).id
    )

    if (filteredTfp.length === 1) {
      this.selectedTfp = filteredTfp[0]
      // return
    }
  }

  get selectedStation (): Station[] {
    return this.$store.getters.selectedStationMap
  }

  get userStations (): Station[] {
    return this.$store.getters.selectedStations
  }

  get tfps (): Tfp[] {
    return this.$store.getters.tfps
  }

  public updateStations (newValue: Station[]) {
    const sourceRef: any = this.$refs.sourceStations
    const source: VectorSource = sourceRef.$source

    if (!source) {
      return
    }

    source.clear()

    if (!newValue || newValue.length === 0) {
      return
    }

    const features: Feature[] = newValue.map((f: Station) => {
      const point = new Point([f.lon, f.lat])
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
        station: f.name,
      })
      return newFeature
    })
    source.addFeatures(features)
  }

  @Watch('userStations')
  public onUserStationsChange (newValue: Station[]) {
    this.updateStations(newValue)
  }

  public updateTfps (newValue: Tfp[]) {
    const sourceRef: any = this.$refs.sourceTfps
    const source: VectorSource = sourceRef.$source

    if (!source) {
      return
    }

    source.clear()

    if (!newValue || newValue.length === 0) {
      return
    }

    const features: Feature[] = newValue.map((f: Tfp) => {
      const point = new Point([f.lon, f.lat])
      point.transform('EPSG:4326', 'EPSG:3857')

      const newFeature = new Feature({
        geometry: point,
      })

      if ('id' in f && f.id) {
        newFeature.setId(f.id)
      } else {
        console.warn('Got a TFP without ID')
        // random number
        newFeature.setId(Math.floor(Math.random() * 999999))
      }

      newFeature.setProperties({
        tfp: f.name,
        eta: f.eta,
        ewh: f.ewh,
      })
      return newFeature
    })
    source.addFeatures(features)
  }

  @Watch('tfps')
  public onTfpsChange (newValue: Tfp[]) {
    this.selectedFeatures = []
    this.updateTfps(newValue)
  }

  @Watch('sizeChanged')
  public onSizeChanged () {
    const map: any = this.$refs.map
    if (map) {
      map.updateSize()
    }
  }

  public featureHasProperty (feature: any, prop: string) {
    return feature &&
      'properties' in feature &&
      feature.properties &&
      prop in feature.properties
  }

  public pointOnSurface (g: any) {
    return findPointOnSurface(g)
  }

  @Watch('resultArrivaltimes')
  public onArrivaltimesChange (newValue: Array<any> | null) {
    this.$nextTick(function () {
      this.$store.commit('SET_MAP_IS_LOADING', false)
    })

    const sourceRef: any = this.$refs.sourceArrivaltimes
    const source: VectorSource = sourceRef.$source
    const sourceWaveRef: any = this.$refs.sourceWavejets
    const sourceWave: VectorSource = sourceWaveRef.$source

    source.clear()
    sourceWave.clear()
    this.selectedFeatures = []

    if (!newValue || newValue.length === 0) {
      return
    }

    const features: Feature[] = newValue.map((f) => {
      const line = new LineString(f.geometry.coordinates)
      line.transform('EPSG:4326', 'EPSG:3857')

      const newFeature = new Feature({
        geometry: line,
      })

      if ('ID' in f.properties && f.properties.ID) {
        newFeature.setId(f.properties.ID)
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

    const featuresWave: Feature[] = wavejets.map((f) => {
      const poly = new MultiPolygon(f.geometry.coordinates)
      poly.transform('EPSG:4326', 'EPSG:3857')
      const newFeature = new Feature({
        geometry: poly,
      })

      if ('ID' in f.properties) {
        newFeature.setId(f.properties.ID)
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
  public onSelectedTabChange () {
    this.selectedFeatures = []
  }

  @Watch('selected')
  public onSelectChange (newValue: Event | null) {
    this.$store.commit('SET_TFPS', [])

    if (!newValue || !('identifier' in newValue)) {
      return
    }

    this.$store.dispatch('getTfpsForEvent', newValue)

    const view: any = this.$refs.view

    view.animate({
      zoom: 6,
      center: [newValue.lon, newValue.lat],
    })
  }

  get hoveredEvent (): Event {
    // return dummy object so we don't need to use v-if
    return this.$store.getters.hoveredEvent || { lat: 0, lon: 0 }
  }

  get hoveredStation () {
    // return dummy object so we don't need to use v-if
    const all: Station[] = this.$store.getters.allStations
    const dummy = { lat: 0, lon: 0 }

    if (!all || all.length === 0) {
      return dummy
    }

    const hov = this.$store.getters.stationHoveredMap

    if (!hov) {
      return dummy
    }

    const filtered = all.filter(station => station.id === hov)

    if (filtered.length === 1) {
      return filtered[0]
    }

    return dummy
  }

  get recentEvents (): Event[] {
    return this.$store.getters.recentEvents
  }

  public pointsStyleFunc (): any {
    return (feature: any) => {
      const mag = feature.get('mag')
      const depth = feature.get('depth')
      const radius = mag
      let depthFill = 'rgb(0,0,0)'

      if (depth >= 0 && depth <= 20) {
        depthFill = 'rgb(255,0,0)' // red
      } else if (depth > 20 && depth <= 50) {
        depthFill = 'rgb(255,127,0)' // orange
      } else if (depth > 50 && depth <= 100) {
        depthFill = 'rgb(255,255,0)' // yellow
      } else if (depth > 100 && depth <= 250) {
        depthFill = 'rgb(0,255,0)' // green
      } else if (depth > 250 && depth <= 500) {
        depthFill = 'rgb(0,0,255)' // blue
      } else if (depth > 500 && depth <= 800) {
        depthFill = 'rgb(127,0,255)' // violet
      }

      const baseStyle = new Style({
        image: new Circle({
          radius,
          stroke: new Stroke({
            color: '#4271A7',
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

  public wavejetsStyleFunc (): any {
    return (feature: any) => {
      const wavemin = feature.get('wavemin')
      let color = 'rgb(0,0,0)'

      if (wavemin === 0) {
        // skip first interval
        return []
      } else if (wavemin === 0.05) {
        color = '#2d9f33'
      } else if (wavemin === 0.3) {
        color = '#fdfd01'
      } else if (wavemin === 0.5) {
        color = '#ff6100'
      } else if (wavemin === 1.0) {
        color = '#f50000'
      } else if (wavemin === 2.0) {
        color = '#ad0000'
      } else if (wavemin === 5.0) {
        color = '#fe00fa'
      } else if (wavemin === 10.0) {
        color = '#5c005c'
      } else {
        return []
      }

      const style = new Style({
        fill: new Fill({
          color,
        }),
      })
      return [style]
    }
  }

  public tfpsStyleFunc (): any {
    return (feature: any) => {
      const props = feature.getProperties()
      let rgb = '173,173,173'

      if ('eta' in props && props.eta !== -1) {
        if ('ewh' in props) {
          const ewh = props.ewh
          if (ewh < 0.2) {
            rgb = '0,204,255'
          } else if (ewh < 0.5) {
            rgb = '255,255,0'
          } else if (ewh < 3) {
            rgb = '255,102,0'
          } else {
            rgb = '255,0,0'
          }
        }
      }

      const style = new Style({
        image: new RegularShape({
          points: 4,
          radius: 6,
          rotation: Math.PI / 4,
          fill: new Fill({
            color: 'rgba(' + rgb + ',0.8)',
          }),
          stroke: new Stroke({
            color: '#000',
            width: 1,
          }),
        } as any),
      })

      return [style]
    }
  }

  public selectedTfpStyleFunc (): any {
    return (feature: any) => {
      const props = feature.getProperties()
      let rgb = '173,173,173'

      if ('eta' in props && props.eta !== -1) {
        if ('ewh' in props) {
          const ewh = props.ewh
          if (ewh < 0.2) {
            rgb = '0,204,255'
          } else if (ewh < 0.5) {
            rgb = '255,255,0'
          } else if (ewh < 3) {
            rgb = '255,102,0'
          } else {
            rgb = '255,0,0'
          }
        }
      }

      const style = new Style({
        image: new RegularShape({
          points: 4,
          radius: 6,
          rotation: Math.PI / 4,
          fill: new Fill({
            color: 'rgba(' + rgb + ',0.8)',
          }),
          stroke: new Stroke({
            color: '#f00',
            width: 2,
          }),
        } as any),
      })

      return [style]
    }
  }

  public stationsStyleFunc (): any {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return (feature: any) => {
      const style = new Style({
        image: new RegularShape({
          points: 3,
          radius: 7,
          fill: new Fill({
            color: this.stationFillColor,
          }),
          stroke: new Stroke({
            color: this.stationOutlineColor,
          }),
        } as any),
      })

      return [style]
    }
  }

  public stationHoveredStyleFunc (): any {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return (feature: any) => {
      const style = new Style({
        image: new RegularShape({
          points: 3,
          radius: 12,
          fill: new Fill({
            color: this.stationFillColor,
          }),
          stroke: new Stroke({
            color: this.stationOutlineColor,
            width: 3,
          }),
        } as any),
      })

      return [style]
    }
  }

  public selectedStationStyleFunc (): any {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return (feature: any) => {
      const style = new Style({
        image: new RegularShape({
          points: 3,
          radius: 7,
          fill: new Fill({
            color: this.stationFillColor,
          }),
          stroke: new Stroke({
            color: 'red',
            width: 3,
          }),
        } as any),
      })

      return [style]
    }
  }

  public onMapPointerMove ({ pixel }: {pixel: number[]}) {
    const map: any = this.$refs.map
    const hit: Feature = map.forEachFeatureAtPixel(pixel, (f: Feature) => f)

    if (!hit) {
      this.$store.commit('SET_STATION_HOVERED_MAP', null)
      return
    }

    const props = hit.getProperties()

    if (!props) {
      return
    }

    if ('station' in props) {
      this.$store.commit('SET_STATION_HOVERED_MAP', hit.getId())
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
