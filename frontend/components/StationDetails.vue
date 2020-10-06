<template>
  <v-window id="station-details-window">
    <h3>Station: {{ selectedStationDetail.slmcode }} - Sensor: {{ selectedStationDetail.sensor }}</h3>
    <v-container class="pa-0">
      <v-row class="mt-3" justify="center">
        <v-col sm="4" md="4" lg="3">
          <v-text-field
            class="time-field"
            v-model="localtime"
            label="Local time"
            hide-details
            outlined
            readonly
          />
        </v-col>
        <v-col sm="4" md="4" lg="3">
          <v-text-field
            class="time-field"
            v-model="utctime"
            label="UTC time"
            hide-details
            outlined
            readonly
          />
        </v-col>
      </v-row>
    </v-container>
    <svg class="mt-7" />
  </v-window>
</template>

<script lang="ts">
import { Vue, Component, Prop, Watch } from 'nuxt-property-decorator'
import { Station, Event } from '../types'
import {
  API_GETSTATIONDATA_URL,
  API_GETSTATIONSIMDATA_URL,
  FORM_ENCODE_CONFIG
} from '../store/constants'
import axios from 'axios'
import querystring from 'querystring'
import * as d3 from 'd3'

@Component({
  components: {}
})
export default class StationPreview extends Vue {
  private localtime: string = ''
  private utctime: string = ''
  private margin: any = { top: 5, left: 35, bottom: 9, right: 10 }
  private width: number = 600
  private height: number = 400
  private marginHoursBefore: number = 3
  private marginHoursAhead: number = 3
  private isLoading: boolean = true
  private data: any[] = []
  private simdata: any[] = []
  private svgNode: any = null
  private timer: number = null

  get selectedStationDetail(): Station {
    return this.$store.getters.selectedStationDetail
  }

  async mounted() {
    await this.updateData()
    this.updateDateTime()
    this.timer = setInterval(this.updateDateTime, 1000)
  }

  public updateDateTime() {
    const cur = new Date()
    this.localtime = cur.getFullYear().toString() + '/'
      + (cur.getMonth() + 1).toString().padStart(2, '0') + '/'
      + cur.getDate().toString().padStart(2, '0') + ' · '
      + cur.getHours().toString().padStart(2, '0') + ':'
      + cur.getMinutes().toString().padStart(2, '0') + ':'
      + cur.getSeconds().toString().padStart(2, '0')
    this.utctime = cur.getUTCFullYear().toString() + '/'
      + (cur.getUTCMonth() + 1).toString().padStart(2, '0') + '/'
      + cur.getUTCDate().toString().padStart(2, '0') + ' · '
      + cur.getUTCHours().toString().padStart(2, '0') + ':'
      + cur.getUTCMinutes().toString().padStart(2, '0') + ':'
      + cur.getUTCSeconds().toString().padStart(2, '0')
  }

  beforeDestroy() {
    clearInterval(this.timer)
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
          station: this.selectedStationDetail.name,
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
        station: this.selectedStationDetail.name,
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
    const selection = d3.select('#station-details-window')
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
}
</script>

<style>
#station-details-window {
  text-align: center;
}
</style>
