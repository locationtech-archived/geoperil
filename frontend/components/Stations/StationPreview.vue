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
  <v-card
    :class="activeClasses"
    outlined
    flat
    @click="handleClick"
  >
    <v-card-subtitle
      class="ma-0 pa-0 station-subtitle"
    >
      {{ station.name }}
    </v-card-subtitle>

    <v-progress-circular
      v-show="isLoading"
      :indeterminate="isLoading"
      size="64"
      width="7"
      color="primary"
      class="station-loading"
    />

    <div
      v-show="!isLoading"
      :id="stationId"
      class="preview-svg-container"
    >
      <svg />
    </div>
  </v-card>
</template>

<script lang="ts">
import querystring from 'querystring'
import axios from 'axios'
import { Vue, Component, Prop, Watch } from 'nuxt-property-decorator'

import { select } from 'd3-selection'
import { format } from 'd3-format'
import { scaleTime, scaleLinear } from 'd3-scale'
import { timeHour, timeMinute } from 'd3-time'
import { utcFormat } from 'd3-time-format'
import { axisLeft, axisBottom } from 'd3-axis'
import { line } from 'd3-shape'
import {
  API_GETSTATIONDATA_URL,
  API_GETSTATIONSIMDATA_URL,
  FORM_ENCODE_CONFIG,
} from '~/store/constants'
import { Station, Event } from '~/types'
import LoadingOverlay from '~/components/Utils/LoadingOverlay.vue'

const d3 = {
  select,
  format,
  scaleTime,
  scaleLinear,
  timeHour,
  timeMinute,
  utcFormat,
  axisLeft,
  axisBottom,
  line,
}

@Component({
  components: {
    LoadingOverlay,
  },
})
export default class StationPreview extends Vue {
  @Prop({ type: Object, required: true }) station!: Station
  private margin: any = { top: 5, left: 35, bottom: 9, right: 10 }
  private width: number = 153
  private height: number = 104
  private marginHoursBefore: number = 2
  private marginHoursAhead: number = 2
  private isLoading: boolean = true
  private data: any[] = []
  private simdata: any[] = []
  private updater: any = null

  /** Number of milliseconds to wait until next data update request */
  private updateInterval: number = 60 * 1000

  /** Adding random additional milliseconds until next request will be made */
  private randomInterval: number = 10 * 1000

  /** Number of minutes the station sends data
   * TODO: get it from the station object dynamically */
  private stationRate: number = 10 * 60

  async mounted () {
    this.startUpdater()
    await this.updateData()
  }

  public startUpdater () {
    this.stopUpdater()

    if (this.updater == null) {
      this.updater = setInterval(
        this.updateData,
        this.updateInterval + Math.random() * this.randomInterval
      )
    }
  }

  public stopUpdater () {
    if (this.updater != null) {
      clearInterval(this.updater)
      this.updater = null
    }
  }

  beforeDestroy () {
    this.stopUpdater()
  }

  get activeClasses () {
    const hoveredMap = this.$store.getters.stationHoveredMap
    const classes = 'rounded-0 station-card'

    if (hoveredMap === this.station.id) {
      return classes + ' station-hovered'
    }

    return classes
  }

  get stationId (): string {
    if (this.station) {
      return 'station-' + this.station.id
    }

    return 'station'
  }

  get stationTimestamp (): Date {
    return this.$store.getters.stationTimestamp
  }

  @Watch('stationTimestamp')
  public onTimestampChange () {
    this.data = []
    this.simdata = []
    this.startUpdater()
    this.updateData()
  }

  public async fetchData () {
    const ts = this.stationTimestamp

    if (!ts) {
      return
    }

    const endts = new Date(ts)
    const selectedEvent: Event = this.$store.getters.selectedEvent
    const lasthours = new Date(ts)
    lasthours.setHours(lasthours.getHours() - this.marginHoursBefore)
    endts.setHours(endts.getHours() + this.marginHoursAhead)
    const endtsSeconds = endts.valueOf() / 1000

    if (selectedEvent) {
      const { data } = await axios.post(
        API_GETSTATIONSIMDATA_URL,
        querystring.stringify({
          evid: selectedEvent.compId,
          station: this.station.name,
          end: endts.toISOString(),
        }),
        FORM_ENCODE_CONFIG
      )

      if (
        data && 'status' in data && data.status === 'success' &&
        'data' in data && Array.isArray(data.data)
      ) {
        this.simdata = []

        for (let i = 0; i < data.data.length; i++) {
          const cur = data.data[i]
          this.simdata.push({
            date: new Date(cur[0]),
            value: Number.parseFloat(cur[1]),
          })
        }
      }
    }

    const { data } = await axios.post(
      API_GETSTATIONDATA_URL,
      querystring.stringify({
        station: this.station.name,
        start: lasthours.toISOString(),
        end: endts.toISOString(),
      }),
      FORM_ENCODE_CONFIG
    )

    if (
      data && 'status' in data && data.status === 'success' &&
      'last' in data && 'data' in data && Array.isArray(data.data)
    ) {
      this.data = []

      for (let i = 0; i < data.data.length; i++) {
        const cur = data.data[i]
        this.data.push({
          date: new Date(cur[0]),
          value: Number.parseFloat(cur[1]),
        })
      }

      if (Math.abs(data.last - endtsSeconds) <= this.stationRate) {
        // we got all the data in the specified interval
        this.stopUpdater()
      }
    }
  }

  public async updateData () {
    this.isLoading = true

    try {
      await this.fetchData()
    } catch (e) {
      console.error(e)
    }

    this.isLoading = false
  }

  private translate (x: number, y: number): string {
    return 'translate(' + x + ',' + y + ')'
  }

  @Watch('data')
  public onDataChange () {
    const selection = d3.select('#' + this.stationId)
    selection.select('svg').selectAll('*').remove()

    let maxY = { value: 0 }
    let minY = { value: 0 }

    if (this.data && this.data.length > 0) {
      maxY = this.data.reduce((a: any, b: any) => {
        return a.value > b.value ? a : b
      })
      minY = this.data.reduce((a: any, b: any) => {
        return a.value < b.value ? a : b
      })
    }

    if (this.simdata && this.simdata.length > 0) {
      const simMaxY = this.simdata.reduce((a: any, b: any) => {
        return a.value > b.value ? a : b
      })
      const simMinY = this.simdata.reduce((a: any, b: any) => {
        return a.value < b.value ? a : b
      })
      maxY.value = Math.max(maxY.value, simMaxY.value)
      minY.value = Math.min(minY.value, simMinY.value)
    }

    const svg = selection.select('svg')
      .attr('width', this.width + this.margin.left + this.margin.right)
      .attr('height', this.height + this.margin.top + this.margin.bottom)
      .append('g')
      .attr('transform', this.translate(this.margin.left, this.margin.top))

    const axisheight = this.height - this.margin.top - this.margin.bottom

    const scaleX = d3.scaleTime()
      .domain([
        d3.timeHour.offset(this.stationTimestamp, -this.marginHoursBefore),
        d3.timeHour.offset(this.stationTimestamp, this.marginHoursAhead),
      ])
      .range([0, this.width - this.margin.right])
      .clamp(true)

    const scaleY = d3.scaleLinear()
      .domain([maxY.value, minY.value])
      .range([0, axisheight])
      .nice()

    const line = d3.line()
      .defined((d: any) => !isNaN(d.value))
      .x((d: any) => scaleX(d.date) as any)
      .y((d: any) => scaleY(d.value) as any)

    // gridlines
    svg.append('g')
      .attr('class', 'grid')
      .attr('transform', this.translate(0, axisheight))
      .call(d3.axisBottom(scaleX)
        .ticks(d3.timeMinute.every(30))
        .tickSize(-this.height + this.margin.bottom + this.margin.top)
        .tickFormat('' as any)
      )

    svg.append('g')
      .attr('class', 'grid')
      .call(d3.axisLeft(scaleY)
        .ticks(5)
        .tickSize(-this.width + this.margin.right)
        .tickFormat('' as any)
      )

    // axes
    svg.append('g')
      .attr('class', 'x-axis')
      .call(
        d3.axisBottom(scaleX)
          .ticks(d3.timeHour.every(1))
          .tickFormat(d3.utcFormat('%H:%M') as any)
      ).attr('transform', this.translate(0, axisheight))

    svg.append('g')
      .attr('class', 'y-axis')
      .call(d3.axisLeft(scaleY).ticks(5).tickFormat(d3.format('.2f')))

    // the lines
    if (this.data && this.data.length > 0) {
      svg.append('path')
        .datum(this.data)
        .attr('fill', 'none')
        .attr('stroke', 'steelblue')
        .attr('stroke-width', 1.5)
        .attr('stroke-linejoin', 'round')
        .attr('stroke-linecap', 'round')
        .attr('d', line)
    }

    if (this.simdata && this.simdata.length > 0) {
      svg.append('path')
        .datum(this.simdata)
        .attr('fill', 'none')
        .attr('stroke', 'red')
        .attr('stroke-width', 1.5)
        .attr('stroke-linejoin', 'round')
        .attr('stroke-linecap', 'round')
        .attr('d', line)
    }
  }

  public handleClick () {
    this.$store.commit('SET_SELECTED_STATION_DETAIL', this.station)
  }
}
</script>

<style>
.station-no-data {
  text-align: center;
}

.preview-svg-container {
  height: 100%;
  line-height: 100px;
}

.station-subtitle {
  text-align: center;
}

.station-card {
  height: 140px;
}

.station-card:hover,
.station-card.station-hovered {
  background-color: rgb(230, 224, 224);
  cursor: pointer;
}

.station-card.v-card--link:focus::before {
  opacity: 0;
}

.station-loading {
  top: -15px;
  left: 65px;
}

.grid line {
  stroke: lightgrey;
  stroke-opacity: 0.7;
  shape-rendering: crispEdges;
}

.grid .domain {
  display: none;
}
</style>
