<template>
  <v-col
    id="station-details-dialog"
    sm="10"
    md="10"
    lg="8"
    class="fill-height pa-1 pr-5"
  >
    <h3 class="mt-3">
      Station: {{ selectedStationDetail.slmcode }} - Sensor: {{ selectedStationDetail.sensor }}
    </h3>
    <CurrentTimeDisplay />
    <v-row class="mb-3" justify="center">
      <svg id="station-details" />
    </v-row>
    <v-row v-if="selectedEvent" justify="center">
      <v-col sm="12" md="9" lg="8">
        <v-expansion-panels v-model="panel">
          <v-expansion-panel>
            <v-expansion-panel-header>Pick values</v-expansion-panel-header>
            <v-expansion-panel-content>
              <v-row>
                <v-col class="pa-0 pr-2 pb-2">
                  <DenseTextField
                    :value="pickedX1Formatted"
                    label="First picked time"
                  />
                </v-col>
                <v-col class="pa-0 pl-2 pb-2">
                  <DenseTextField
                    :value="pickedX2Formatted"
                    label="Second picked time"
                  />
                </v-col>
              </v-row>
              <v-row>
                <v-col class="pa-0 pb-2">
                  <DenseTextField
                    :value="pickedTimeDifferenceFormatted"
                    label="Picked time difference"
                  />
                </v-col>
                <v-col cols="1" class="pa-0 multiply-col">
                  <span>x</span>
                </v-col>
                <v-col class="pa-0 pb-2">
                  <v-select
                    v-model="period"
                    :items="[1, 2, 4]"
                    label="Period"
                    class="ma-0"
                    hide-details
                    outlined
                    dense
                  />
                </v-col>
                <v-col cols="1" class="pa-0 multiply-col">
                  <span>=</span>
                </v-col>
                <v-col class="pa-0 pb-2">
                  <DenseTextField
                    :value="periodTimeDifferenceFormatted"
                    label="Time difference"
                  />
                </v-col>
              </v-row>
              <v-row>
                <v-col class="pa-0 pr-2">
                  <DenseTextField
                    :value="pickedYFormatted"
                    label="Picked amplitude"
                  />
                </v-col>
                <v-col class="pa-0 pl-2">
                  <DenseTextField
                    :value="pickedArrivalFormatted"
                    label="Picked time of arrival"
                  />
                </v-col>
              </v-row>
              <v-row justify="end">
                <v-col
                  cols="9"
                  class="pb-0 pl-0"
                >
                  <v-alert
                    v-if="!!errorMsg"
                    class="pa-2 mb-0"
                    type="error"
                  >
                    {{ errorMsg }}
                  </v-alert>
                  <v-alert
                    v-if="!!successMsg"
                    class="pa-2 mb-0"
                    type="success"
                  >
                    {{ successMsg }}
                  </v-alert>
                </v-col>
                <v-col
                  cols="3"
                  align="end"
                  class="pb-0 pr-0"
                >
                  <v-btn
                    type="submit"
                    color="success"
                    @click="save"
                  >
                    Save
                  </v-btn>
                </v-col>
              </v-row>
            </v-expansion-panel-content>
          </v-expansion-panel>
        </v-expansion-panels>
      </v-col>
    </v-row>
  </v-col>
</template>

<script lang="ts">
import querystring from 'querystring'
import { Vue, Component, Watch } from 'nuxt-property-decorator'
import axios from 'axios'
import * as d3 from 'd3'
import { Station, Event } from '../types'
import {
  API_GETSTATIONDATA_URL,
  API_GETSTATIONSIMDATA_URL,
  FORM_ENCODE_CONFIG,
  API_SAVEPICKING_URL,
  API_LOADPICKING_URL,
} from '../store/constants'
import { toUtcTimeStr } from '../plugins/geoperil-utils'
import CurrentTimeDisplay from './CurrentTimeDisplay.vue'
import DenseTextField from './DenseTextField.vue'

if (!Object.getOwnPropertyNames(d3).includes('event')) {
  // avoid redefining
  // eslint-disable-next-line no-import-assign
  Object.defineProperty(d3, 'event', {
    get () { return event },
  })
}

@Component({
  components: {
    CurrentTimeDisplay,
    DenseTextField,
  },
})
export default class StationDetails extends Vue {
  private containerId = '#station-details-dialog'
  private margin: any = { top: 5, left: 47, bottom: 8, right: 11 }
  private width: number = 600
  private height: number = 400
  private axisheight: number = 0
  private marginHoursBefore: number = 3
  private marginHoursAhead: number = 5
  private isLoading: boolean = true
  private panel: any = null
  private pickedLoaded: boolean = false
  private pickedX1: Date | null = null
  private pickedX2: Date | null = null
  private pickedArrival: Date | null = null
  private pickedY: number | null = null
  private pickedTimeDifference: Date | null = null
  private period: number = 1
  private periodTimeDifference: number | null = null
  private data: any[] = []
  private simdata: any[] = []
  private svg: any = null
  private lineDefinition: any = null
  private lineData: any = null
  private lineSim: any = null
  private scaleX: any = null
  private scaleXReference: any = null
  private scaleYReference: any = null
  private scaleY: any = null
  private d3GridAxisX: any = null
  private d3GridAxisY: any = null
  private gGridAxisX: any = null
  private gGridAxisY: any = null
  private d3AxisX: any = null
  private d3AxisY: any = null
  private gaxisX: any = null
  private gaxisY: any = null
  private sliderX1: any = null
  private sliderX2: any = null
  private sliderArrival: any = null
  private sliderY: any = null
  private updater: any = null
  private errorMsg: string | null = null
  private successMsg: string | null = null

  /** Number of milliseconds to wait until next data update request */
  private updateInterval: number = 30 * 1000

  /** Number of minutes the station sends data
   * TODO: get it from the station object dynamically */
  private stationRate: number = 10 * 60

  get selectedStationDetail (): Station {
    return this.$store.getters.selectedStationDetail
  }

  get selectedEvent (): Event {
    return this.$store.getters.selectedEvent
  }

  created () {
    this.axisheight = this.height - this.margin.top - this.margin.bottom
  }

  async mounted () {
    this.startUpdater()
    await this.updateData()
  }

  public startUpdater () {
    this.stopUpdater()

    if (this.updater == null) {
      this.updater = setInterval(this.updateData, this.updateInterval)
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

  public convertToMinutes (milliseconds: number): number {
    const seconds = milliseconds / 1000
    return seconds / 60
  }

  @Watch('showSliders')
  public async onShowSlidersChange () {
    if (!this.pickedLoaded) {
      await this.loadPickedValues()
      this.pickedLoaded = true
    }
    this.updateSliderVisible()
    this.updatePickedValues()
  }

  get stationTimestamp (): Date {
    return this.$store.getters.stationTimestamp
  }

  get showSliders (): boolean {
    return this.panel === 0
  }

  get pickedX1Formatted (): string {
    if (this.pickedX1) {
      return toUtcTimeStr(this.pickedX1, false, false) + ' UTC'
    }

    return ''
  }

  get pickedX2Formatted (): string {
    if (this.pickedX2) {
      return toUtcTimeStr(this.pickedX2, false, false) + ' UTC'
    }

    return ''
  }

  get pickedArrivalFormatted (): string {
    if (this.pickedArrival) {
      return toUtcTimeStr(this.pickedArrival, false, false) + ' UTC'
    }

    return ''
  }

  get pickedYFormatted (): string {
    if (this.pickedY) {
      const pickedMeters = this.pickedY.toFixed(2)
      return pickedMeters + ' Meters'
    }

    return ''
  }

  get pickedTimeDifferenceFormatted (): string {
    if (this.pickedTimeDifference) {
      const minutes = this.convertToMinutes(
        this.pickedTimeDifference.valueOf()
      )
      return minutes.toFixed(2) + ' Minutes'
    }

    return ''
  }

  get periodTimeDifferenceFormatted (): string {
    if (this.periodTimeDifference) {
      return this.periodTimeDifference.toFixed(2) + ' Minutes'
    }

    return ''
  }

  @Watch('period')
  public onPeriodChange () {
    this.updateTimeDifference()
  }

  @Watch('stationTimestamp')
  public onTimestampChange () {
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
          station: this.selectedStationDetail.name,
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
        station: this.selectedStationDetail.name,
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

  private updateSliderVisible () {
    d3.select(this.containerId)
      .selectAll('.slider')
      .attr('display', this.showSliders ? 'inline' : 'none')
  }

  private updateLines () {
    if (this.lineDefinition) {
      if (this.lineData) {
        this.lineData.attr('d', this.lineDefinition)
      }

      if (this.lineSim) {
        this.lineSim.attr('d', this.lineDefinition)
      }
    }
  }

  private getTransformValues (transform: string) {
    const reg = new RegExp('translate\\((.*),(.*)\\)')

    if (!transform || transform.length === 0 || !reg.test(transform)) {
      return [null, null]
    }

    const regXY = new RegExp('translate\\((.*)\\)')
    const matches = regXY.exec(transform)

    // matches[0] contains full match
    if (!matches || matches.length !== 2) {
      return [null, null]
    }

    const splitted = matches[1].split(',')

    if (!splitted || splitted.length !== 2) {
      return [null, null]
    }

    return splitted
  }

  private updateTimeDifference () {
    if (this.pickedX1 && this.pickedX2) {
      // https://stackoverflow.com/a/14980125/2249798
      this.pickedTimeDifference = new Date(+(this.pickedX2) - +(this.pickedX1))
    } else {
      this.pickedTimeDifference = new Date(0)
    }

    const minutes = this.convertToMinutes(this.pickedTimeDifference.valueOf())
    this.periodTimeDifference = minutes * this.period
  }

  private updatePickedValues () {
    this.pickedX1 = null
    this.pickedX2 = null
    this.pickedArrival = null
    this.pickedY = null
    this.errorMsg = null
    this.successMsg = null

    if (
      !this.showSliders || !this.sliderX1 || !this.sliderX2 ||
      !this.sliderY || !this.sliderArrival
    ) {
      return
    }

    const transX1 = this.sliderX1.attr('transform')
    const transX2 = this.sliderX2.attr('transform')
    const transArrival = this.sliderArrival.attr('transform')
    const transY = this.sliderY.attr('transform')

    if (transX1) {
      const x = this.getTransformValues(transX1)[0]

      if (x != null) {
        this.pickedX1 = this.scaleX.invert(x)
      }
    }

    if (transX2) {
      const x = this.getTransformValues(transX2)[0]

      if (x != null) {
        this.pickedX2 = this.scaleX.invert(x)
      }
    }

    if (transArrival) {
      const x = this.getTransformValues(transArrival)[0]

      if (x != null) {
        this.pickedArrival = this.scaleX.invert(x)
      }
    }

    if (transY) {
      const y = this.getTransformValues(transY)[1]

      if (y != null) {
        this.pickedY = this.scaleY.invert(y)
      }
    }

    if (
      this.pickedX1 && this.pickedX2 &&
      this.pickedX1.valueOf() > this.pickedX2.valueOf()
    ) {
      const swap = this.pickedX2
      this.pickedX2 = this.pickedX1
      this.pickedX1 = swap
    }

    this.updateTimeDifference()
  }

  private zoom (event: any) {
    if (!event || !event.transform) {
      return
    }

    d3.select(this.containerId)
      .select('.dataview')
      .attr('transform', event.transform)

    d3.select(this.containerId)
      .select('.simview')
      .attr('transform', event.transform)

    if (this.gaxisX && this.d3AxisX && this.scaleXReference) {
      this.scaleX = event.transform.rescaleX(this.scaleXReference)
      this.gaxisX.call(
        this.d3AxisX.scale(this.scaleX)
      )
      this.gGridAxisX.call(
        this.d3GridAxisX.scale(this.scaleX)
      )
    }

    if (this.gaxisY && this.d3AxisY && this.scaleYReference) {
      this.scaleY = event.transform.rescaleY(this.scaleYReference)
      this.gaxisY.call(
        this.d3AxisY.scale(this.scaleY)
      )
      this.gGridAxisY.call(
        this.d3GridAxisY.scale(this.scaleY)
      )
    }

    this.updateLines()
    this.updatePickedValues()
  }

  private findMinMaxY (): any {
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

    return { miny: minY.value, maxy: maxY.value }
  }

  public addScales () {
    const minmax = this.findMinMaxY()
    const minY = minmax.miny
    const maxY = minmax.maxy

    this.scaleX = d3.scaleTime()
      .domain([
        d3.timeHour.offset(this.stationTimestamp, -this.marginHoursBefore),
        d3.timeHour.offset(this.stationTimestamp, this.marginHoursAhead),
      ])
      .range([0, this.width - this.margin.right])
      .clamp(true)

    this.scaleXReference = this.scaleX.copy()

    this.scaleY = d3.scaleLinear()
      .domain([maxY + 0.5, minY - 0.5])
      .range([0, this.axisheight])
      .nice()

    this.scaleYReference = this.scaleY.copy()
  }

  public addGridlines () {
    this.d3GridAxisX = d3.axisBottom(this.scaleX)
      .ticks(d3.timeMinute.every(30))
      .tickSize(-this.height + this.margin.bottom + this.margin.top)
      .tickFormat('' as any)

    this.gGridAxisX = this.svg.append('g')
      .attr('class', 'grid')
      .attr('transform', this.translate(0, this.axisheight))
      .call(this.d3GridAxisX)

    this.d3GridAxisY = d3.axisLeft(this.scaleY)
      .ticks(5)
      .tickSize(-this.width + this.margin.right)
      .tickFormat('' as any)

    this.gGridAxisY = this.svg.append('g')
      .attr('class', 'grid')
      .call(this.d3GridAxisY)
  }

  public addAxes () {
    this.d3AxisX = d3.axisBottom(this.scaleX)
      .ticks(d3.timeHour.every(1))
      .tickFormat(d3.utcFormat('%H:%M') as any)

    this.gaxisX = this.svg.append('g')
      .attr('class', 'x-axis')
      .call(this.d3AxisX).attr('transform', this.translate(0, this.axisheight))

    this.d3AxisY = d3.axisLeft(this.scaleY)
      .ticks(5)
      .tickFormat(d3.format('.2f') as any)

    this.gaxisY = this.svg.append('g')
      .attr('class', 'y-axis')
      .call(this.d3AxisY)
  }

  public dragX1 (event: any) {
    const x = Math.min(Math.max(event.x, 0), this.width)
    d3.select('.sliderx1').attr('transform', this.translate(x, 0))
    this.updatePickedValues()
  }

  public dragX2 (event: any) {
    const x = Math.min(Math.max(event.x, 0), this.width)
    d3.select('.sliderx2').attr('transform', this.translate(x, 0))
    this.updatePickedValues()
  }

  public dragArrival (event: any) {
    const x = Math.min(Math.max(event.x, 0), this.width)
    d3.select('.sliderarrival').attr('transform', this.translate(x, 0))
    this.updatePickedValues()
  }

  public dragY (event: any) {
    const y = Math.min(Math.max(event.y, 0), this.height)
    d3.select('.slidery').attr('transform', this.translate(-40, y))
    this.updatePickedValues()
  }

  public addSliders () {
    const triangle = d3.symbol()
      .type(d3.symbolTriangle)
      .size(100)

    this.sliderX1 = this.svg.append('g')
      .attr('class', 'slider sliderx1')
      .attr('display', 'none')
      .attr('transform', this.translate(0, 0))
      .call(d3.drag().on('drag', this.dragX1))

    this.sliderX1.append('line')
      .attr('x2', 0)
      .attr('y2', this.height)

    this.sliderX1.append('path')
      .attr('d', triangle)
      .attr('transform', this.translate(0, this.height))

    this.sliderX2 = this.svg.append('g')
      .attr('class', 'slider sliderx2')
      .attr('display', 'none')
      .attr('transform', this.translate(this.width, 0))
      .call(d3.drag().on('drag', this.dragX2))

    this.sliderX2.append('line')
      .attr('x2', 0)
      .attr('y2', this.height)

    this.sliderX2.append('path')
      .attr('d', triangle)
      .attr('transform', this.translate(0, this.height))

    this.sliderArrival = this.svg.append('g')
      .attr('class', 'slider sliderarrival')
      .attr('display', 'none')
      .attr('transform', this.translate(this.width / 2, 0))
      .call(d3.drag().on('drag', this.dragArrival))

    this.sliderArrival.append('line')
      .attr('x2', 0)
      .attr('y2', this.height)

    this.sliderArrival.append('path')
      .attr('d', triangle)
      .attr('transform', this.translate(0, this.height))

    this.sliderY = this.svg.append('g')
      .attr('class', 'slider slidery')
      .attr('display', 'none')
      .attr('transform', this.translate(-40, this.height / 2))
      .call(d3.drag().on('drag', this.dragY))

    this.sliderY.append('line')
      .attr('x2', this.width + 40)
      .attr('y2', 0)

    this.sliderY.append('path')
      .attr('d', triangle)
      .attr('transform', this.translate(0, 0) + ' rotate(90)')
  }

  public addLines () {
    this.lineDefinition = d3.line()
      .defined((d: any) => !isNaN(d.value))
      .x((d: any) => this.scaleXReference(d.date) as any)
      .y((d: any) => this.scaleYReference(d.value) as any)

    if (this.data && this.data.length > 0) {
      const container = this.svg.append('g').attr('class', 'dataview')
      this.lineData = container.append('path')
        .datum(this.data)
        .attr('fill', 'none')
        .attr('stroke', 'steelblue')
        .attr('stroke-width', 1.5)
        .attr('stroke-linejoin', 'round')
        .attr('stroke-linecap', 'round')
        .attr('d', this.lineDefinition)
    }

    if (this.simdata && this.simdata.length > 0) {
      const container = this.svg.append('g').attr('class', 'simview')
      this.lineSim = container.append('path')
        .datum(this.simdata)
        .attr('fill', 'none')
        .attr('stroke', 'red')
        .attr('stroke-width', 1.5)
        .attr('stroke-linejoin', 'round')
        .attr('stroke-linecap', 'round')
        .attr('d', this.lineDefinition)
    }
  }

  @Watch('data')
  public onDataChange () {
    const alreadyDrawn = (
      d3.select(this.containerId).selectAll('.dataview').size() !== 0
    )

    if (!alreadyDrawn) {
      // diagram will be drawn the first time
      const selection = d3.select(this.containerId)
      selection.select('svg').selectAll('*').remove()

      this.svg = selection.select('svg')
        .attr('width', this.width + this.margin.left + this.margin.right)
        .attr('height', this.height + this.margin.top + this.margin.bottom)
        .append('g')
        .attr('transform', this.translate(this.margin.left, this.margin.top))

      const zoom = d3.zoom()
        .scaleExtent([1, 2])
        .translateExtent([[0, 0], [this.width, this.height]])
        .on('zoom', this.zoom)

      this.addScales()
      this.addGridlines()
      this.addAxes()
      this.addSliders()
      this.addLines()

      const initialTransform = d3.zoomIdentity.translate(
        (this.margin.left + this.margin.right) / 2,
        (this.margin.top + this.margin.bottom) / 2
      ).scale(1)

      selection.select('svg')
        .call(zoom as any)
        .call(zoom.transform as any, initialTransform)
        .on('dblclick.zoom', null)
    } else {
      // there was a data update
      if (this.data && this.data.length > 0 && this.lineData) {
        this.lineData.datum(this.data)
      }

      if (this.simdata && this.simdata.length > 0 && this.lineSim) {
        this.lineSim.datum(this.simdata)
      }

      this.updateLines()
    }
  }

  public async loadPickedValues () {
    const { data } = await axios.post(
      API_LOADPICKING_URL,
      querystring.stringify({
        evtid: this.selectedEvent.compId,
        station: this.selectedStationDetail.name,
      }),
      FORM_ENCODE_CONFIG
    )

    if ('status' in data && data.status === 'success' && 'data' in data) {
      const saved = data.data
      const x1 = this.scaleX(new Date(saved.time1))
      d3.select('.sliderx1').attr('transform', this.translate(x1, 0))

      const x2 = this.scaleX(new Date(saved.time2))
      d3.select('.sliderx2').attr('transform', this.translate(x2, 0))

      const arrival = this.scaleX(new Date(saved.arrival))
      d3.select('.sliderarrival').attr('transform', this.translate(arrival, 0))

      const y = this.scaleY(saved.amplitude)
      d3.select('.slidery').attr('transform', this.translate(-40, y))

      this.period = saved.multiplier
    }
  }

  public async save () {
    this.successMsg = null
    this.errorMsg = null

    try {
      const { data } = await axios.post(
        API_SAVEPICKING_URL,
        querystring.stringify({
          evtid: this.selectedEvent.compId,
          station: this.selectedStationDetail.name,
          data: JSON.stringify({
            time1: this.pickedX1,
            time2: this.pickedX2,
            period: this.periodTimeDifference,
            multiplier: this.period,
            amplitude: this.pickedY,
            arrival: this.pickedArrival,
          }),
        }),
        FORM_ENCODE_CONFIG
      )

      if (
        'status' in data && data.status === 'success'
      ) {
        this.successMsg = 'Picked values saved successfully'
      } else {
        this.errorMsg = 'Saving the picked values was not successful'
      }
    } catch (e) {
      this.errorMsg = e.message
    }
  }
}
</script>

<style>
#station-details-dialog {
  text-align: center;
  overflow-y: auto;
}

svg#station-details {
  cursor: pointer;
}

.slider path {
  cursor: move;
  stroke: none;
  fill: black;
}

.sliderarrival path {
  fill: #c60000 !important;
}

.sliderarrival path:hover {
  stroke: #c60000 !important;
  fill: #c60000 !important;
}

.slider path:hover {
  stroke: black;
  fill: black;
}

.slider line {
  fill: none;
  stroke: black;
  stroke-width: 1px;
}

.sliderarrival line {
  stroke: #c60000 !important;
}

.multiply-col {
  max-height: 40px;
  max-width: 20px;
}

.multiply-col span {
  line-height: 40px;
}
</style>
