<template>
  <v-card outlined flat class="rounded-0 station-card">
    <v-card-subtitle class="ma-0 pa-0 station-subtitle">{{ station.name }}</v-card-subtitle>
    <v-progress-circular
      :indeterminate="isLoading"
      v-show="isLoading"
      size="64"
      width="7"
      color="primary"
      class="station-loading"
    />
    <div class="preview-svg-container" v-show="!isLoading" :id="stationId">
      <div class="station-no-data" v-if="!isLoading && (!this.data || this.data.length == 0)"><em>No data available.</em></div>
      <svg />
    </div>
  </v-card>
</template>

<script lang="ts">
import { Vue, Component, Prop, Watch } from 'nuxt-property-decorator'
import { Station } from '../types'
import { API_GETSTATIONDATA_URL, FORM_ENCODE_CONFIG } from '../store/constants'
import LoadingOverlay from './LoadingOverlay.vue'
import axios from 'axios'
import querystring from 'querystring'
import * as d3 from 'd3'

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
  private isLoading: boolean = true
  private data: any[] = []
  private svgNode: any = null

  async mounted() {
      await this.updateData()
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

    const last3hours = new Date(ts)
    last3hours.setHours(last3hours.getHours() - 3)

    const { data } = await axios.post(
      API_GETSTATIONDATA_URL,
      querystring.stringify({
        station: this.station.name,
        start: last3hours.toISOString(),
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
    if (!this.data || this.data.length == 0) {
      return
    }

    const maxY = this.data.reduce((a: any, b: any) => {
      return a.value > b.value ? a : b
    })
    const minY = this.data.reduce((a: any, b: any) => {
      return a.value < b.value ? a : b
    })

    const selection = d3.select('#' + this.stationId)
    selection.select('svg').selectAll('*').remove()

    const svg = selection.select('svg')
      .attr('width', this.width + this.margin.left + this.margin.right)
      .attr('height', this.height + this.margin.top + this.margin.bottom)
      .append('g')
      .attr('transform', this.translate(this.margin.left, this.margin.top))

    const axisheight = this.height - this.margin.top - this.margin.bottom

    const scaleX = d3.scaleTime()
      .domain([
        d3.timeHour.offset(this.stationTimestamp, -3),
        d3.timeMinute.offset(this.stationTimestamp, 15)]
      )
      .range([0, this.width - this.margin.right])
      .clamp(true)

    const scaleY = d3.scaleLinear()
      .domain([maxY.value, minY.value])
      .range([0, axisheight])
      .nice()

    const line = d3.line()
      .defined((d: any) => !isNaN(d.value))
      .x((d: any) => scaleX(d.date))
      .y((d: any) => scaleY(d.value))

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
          .tickFormat(d3.timeFormat('%H:%M') as any)
      ).attr('transform', this.translate(0, axisheight))

    svg.append('g')
      .attr('class', 'y-axis')
      .call(d3.axisLeft(scaleY).ticks(5).tickFormat(d3.format('.2f')))

    // the line
    svg.append('path')
      .datum(this.data)
      .attr('fill', 'none')
      .attr('stroke', 'steelblue')
      .attr('stroke-width', 1.5)
      .attr('stroke-linejoin', 'round')
      .attr('stroke-linecap', 'round')
      .attr('d', line)
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
