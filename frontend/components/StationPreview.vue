<template>
  <v-card
    :class="activeClasses"
    @click="handleClick"
    outlined
    flat
  >
    <v-card-subtitle
      class="ma-0 pa-0 station-subtitle"
    >{{ station.name }}</v-card-subtitle>

    <v-progress-circular
      :indeterminate="isLoading"
      v-show="isLoading"
      size="64"
      width="7"
      color="primary"
      class="station-loading"
    />

    <div
      class="preview-svg-container"
      v-show="!isLoading"
      :id="stationId"
    >
      <svg />
    </div>
  </v-card>
</template>

<script lang="ts">
import { Vue, Component, Prop, Watch } from 'nuxt-property-decorator'
import { Station, Event } from '../types'
import {
  API_GETSTATIONDATA_URL,
  API_GETSTATIONSIMDATA_URL,
  FORM_ENCODE_CONFIG
} from '../store/constants'
import LoadingOverlay from './LoadingOverlay.vue'
import axios from 'axios'
import querystring from 'querystring'

import { select } from 'd3-selection'
import { format } from 'd3-format'
import { scaleTime, scaleLinear } from 'd3-scale'
import { timeHour, timeMinute } from 'd3-time'
import { utcFormat } from 'd3-time-format'
import { axisLeft, axisBottom } from 'd3-axis'
import { line } from 'd3-shape'

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
    LoadingOverlay
  }
})
export default class StationPreview extends Vue {
  @Prop({ type: Object, required: true }) station!: Station
  private margin: any = { top: 5, left: 35, bottom: 9, right: 10 }
  private width: number = 153
  private height: number = 104
  private marginHoursBefore: number = 1
  private marginHoursAhead: number = 2
  private isLoading: boolean = true
  private data: any[] = []
  private simdata: any[] = []

  async mounted() {
      await this.updateData()
  }

  get activeClasses() {
    const hoveredMap = this.$store.getters.stationHoveredMap
    const classes = 'rounded-0 station-card'

    if (hoveredMap == this.station.id) {
      return classes + ' station-hovered'
    }

    return classes
  }

  get stationId(): string {
    if (this.station) {
      return 'station-' + this.station.id
    }

    return 'station'
  }

  get stationTimestamp(): Date {
    return this.$store.getters.stationTimestamp
  }

  @Watch('stationTimestamp')
  public onTimestampChange(newValue: Date | null) {
    this.updateData()
  }

  public async fetchData() {
    const ts = this.stationTimestamp

    if (!ts) {
      return
    }

    const endts = new Date(ts)
    const selectedEvent: Event = this.$store.getters.selectedEvent
    const lasthours = new Date(ts)
    lasthours.setHours(lasthours.getHours() - this.marginHoursBefore)
    endts.setHours(endts.getHours() + this.marginHoursAhead)

    if (selectedEvent) {
      var { data } = await axios.post(
        API_GETSTATIONSIMDATA_URL,
        querystring.stringify({
          evid: selectedEvent.compId,
          station: this.station.name,
          end: endts.toISOString()
        }),
        FORM_ENCODE_CONFIG
      )

      if (
        data && 'status' in data && data.status == 'success'
        && 'data' in data && data.data instanceof Array
      ) {
        for (let i = 0; i < data.data.length; i++) {
          const cur = data.data[i]
          this.simdata.push({
            date: new Date(cur[0]),
            value: Number.parseFloat(cur[1])
          })
        }
      }
    }

    var { data } = await axios.post(
      API_GETSTATIONDATA_URL,
      querystring.stringify({
        station: this.station.name,
        start: lasthours.toISOString(),
        end: endts.toISOString(),
        inst: 'slm'
      }),
      FORM_ENCODE_CONFIG
    )

    if (
      data && 'status' in data && data.status == 'success'
      && 'data' in data && data.data instanceof Array
    ) {
      for (let i = 0; i < data.data.length; i++) {
        const cur = data.data[i]
        this.data.push({
          date: new Date(cur[0]),
          value: Number.parseFloat(cur[1])
        })
      }
    }
  }

  public async updateData() {
    this.isLoading = true
    this.data = []
    this.simdata = []

    try {
      await this.fetchData()
    } catch (e) {
      console.error(e)
    }

    this.isLoading = false
  }

  private translate(x: number, y: number): string {
    return 'translate(' + x + ',' + y + ')'
  }

  @Watch('data')
  public onDataChange(newValue: any[]) {
    const selection = d3.select('#' + this.stationId)
    selection.select('svg').selectAll('*').remove()

    var maxY = { value: 0 }
    var minY = { value: 0 }

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
        d3.timeHour.offset(this.stationTimestamp, this.marginHoursAhead)
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

  public handleClick() {
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
