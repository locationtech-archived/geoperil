<template>
  <v-form
    class="pa-3"
    id="compose-form"
    ref="form"
    v-model="valid"
  >
    <v-text-field
      v-model="name"
      ref="refName"
      label="Name"
      :rules="[v => !!v || 'Name is required']"
      required
    />

    <v-text-field
      v-model="date"
      label="Date"
      disabled
    />

    <v-text-field
      v-model="lat"
      label="Latitude"
      :rules="validLat"
      suffix="°"
      required
    />

    <v-text-field
      v-model="lon"
      label="Longitude"
      :rules="validLon"
      suffix="°"
      required
    />

    <v-text-field
      :disabled="!!slip || !!len || !!width"
      v-model="mag"
      label="Magnitude"
      :rules="validMag"
      suffix="Mw"
      required
    />

    <v-text-field
      :disabled="!!mag"
      v-model="slip"
      label="Slip"
      suffix="m"
    />

    <v-text-field
      :disabled="!!mag"
      v-model="len"
      label="Length"
      suffix="km"
    />

    <v-text-field
      :disabled="!!mag"
      v-model="width"
      label="Width"
      suffix="km"
    />

    <v-text-field
      v-model="depth"
      label="Depth"
      :rules="validDepth"
      suffix="km"
      required
    />

    <v-text-field
      v-model="dip"
      label="Dip"
      :rules="validDip"
      suffix="°"
      required
    />

    <v-text-field
      v-model="strike"
      label="Strike"
      :rules="validStrike"
      suffix="°"
      required
    />

    <v-text-field
      v-model="rake"
      label="Rake"
      :rules="validRake"
      suffix="°"
      required
    />

    <v-text-field
      v-model="duration"
      label="Duration"
      :rules="validDuration"
      suffix="min"
      required
    />

    <v-select
      v-model="selAlgorithm"
      :items="algorithms"
      :rules="validAlgorithm"
      label="Algorithm"
      required
    ></v-select>

    <v-select
      v-model="selResolution"
      :items="resolutions"
      :rules="validResolution"
      label="Grid resolution"
      suffix="°"
      required
    ></v-select>

    <v-alert
      type="error"
      v-if="!!errorMsg"
    >
      {{ errorMsg }}
    </v-alert>

    <v-row justify="space-between">
      <v-col cols="auto">
        <v-btn
          @click="reset"
        >
          Clear
        </v-btn>
      </v-col>

      <v-col cols="auto">
        <v-btn
          :disabled="!isValid"
          color="primary"
          @click="send"
        >
          Start
        </v-btn>
      </v-col>
    </v-row>
  </v-form>
</template>

<script lang="ts">
import { Vue, Component, Watch } from 'nuxt-property-decorator'
import { Event, ComputeRequest } from '../types'

@Component({})
export default class ComposeSimulation extends Vue {
  private name: string = ''
  private date: string = ''
  private datetime: Date | null = new Date()
  private lat: number | null = null
  private lon: number | null = null
  private mag: number | null = null
  private slip: number | null = null
  private len: number | null = null
  private width: number | null = null
  private depth: number | null = null
  private dip: number | null = null
  private strike: number | null = null
  private rake: number | null = null
  private duration: number = 180
  private selAlgorithm: string = 'EasyWave'
  private algorithms: string[] = [
    'EasyWave',
  ]
  private selResolution: number = 120
  private resolutions: number[] = [
    120,
    60,
    30
  ]
  private valid: boolean = true
  private errorMsg: string | null = null

  private validLat: Function[] = [
    (v: any) => !!v || 'Latitude is required',
    (v: any) => (v >= -90 && v <= 90) || 'Invalid latitude',
  ]

  private validLon: Function[] = [
    (v: any) => !!v || 'Longitude is required',
    (v: any) => (v >= -180 && v <= 180) || 'Invalid longitude',
  ]

  private validMag: Function[] = [
    (v: any) => !v || (v >= 0 && v <= 11) || 'Invalid magnitude',
  ]

  private validDepth: Function[] = [
    (v: any) => !!v || 'Depth is required',
  ]

  private validDip: Function[] = [
    (v: any) => !!v || 'Dip is required',
    (v: any) => (v >= 0 && v <= 90) || 'Invalid dip',
  ]

  private validStrike: Function[] = [
    (v: any) => !!v || 'Strike is required',
    (v: any) => (v >= 0 && v <= 360) || 'Invalid strike',
  ]

  private validRake: Function[] = [
    (v: any) => !!v || 'Rake is required',
    (v: any) => (v >= -180 && v <= 180) || 'Invalid rake',
  ]

  private validDuration: Function[] = [
    (v: any) => !!v || 'Duration is required',
    (v: any) => (v > 0 && v <= 420) || 'Invalid duration',
  ]

  private validAlgorithm: Function[] = [
    (v: any) => !!v || 'Algorithm is required',
  ]

  private validResolution: Function[] = [
    (v: any) => !!v || 'Resolution is required',
  ]

  get isValid(): boolean {
    if (
      (!this.mag || this.mag.toString() == '')
      && (!this.slip || this.slip.toString() == '')
    ) {
      return false
    }

    if (!!this.slip && (!this.len || !this.width)) {
      return false
    }

    if (!this.valid) {
      return false
    }

    return true
  }

  public async send() {
    this.errorMsg = null
    const f: any = this.$refs.form

    try {
      await this.$store.dispatch(
        'sendCompute',
        {
          event: {
              region: this.name,
              datetime: this.datetime,
              lat: this.lat,
              lon: this.lon,
              mag: this.mag,
              depth: this.depth,
              dip: this.dip,
              strike: this.strike,
              rake: this.rake,
              slip: this.slip,
              len: this.len,
              width: this.width,
          } as Event,
          duration: this.duration,
          algorithm: this.selAlgorithm,
          gridres: this.selResolution
        } as ComputeRequest
      )
    } catch (e) {
      this.errorMsg = e.message
      return
    }

    f.reset()
    this.$emit('change-to-mylist-tab')
  }

  public initFromCompose(): void {
    const ev = this.composeEvent

    if (!ev) {
      return
    }

    this.name = ev.region
    this.datetime = ev.datetime
    this.date = ev.date + ' - ' + ev.time
    this.lat = ev.lat
    this.lon = ev.lon
    this.mag = ev.mag
    this.depth = ev.depth
    this.dip = ev.dip
    this.strike = ev.strike
    this.rake = ev.rake
    this.duration = 180
    this.selAlgorithm = 'EasyWave'
    this.selResolution = 120

    // we used all the information, now safe to unset again
    this.$store.commit('SET_COMPOSE', null)
  }

  public reset(): void {
    const f: any = this.$refs.form
    f.reset()
  }

  mounted() {
    this.initFromCompose()
    const f: any = this.$refs.form
    f.validate()
  }

  @Watch('composeEvent')
  public onComposeChange(newValue: Event | null) {
    this.initFromCompose()
  }

  get composeEvent(): Event | null {
    return this.$store.getters.composeEvent
  }
}
</script>

<style>
#compose-form {
  height: 100%;
  overflow-y: auto;
}
</style>
