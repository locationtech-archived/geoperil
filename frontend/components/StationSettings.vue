<template>
  <v-container>
    <h4 class="mb-2">
      Select your countries of interest ({{ countSelected }} selected):
    </h4>
    <v-row
      id="stationselect-row"
      justify="start"
    >
      <v-col
        v-for="(count, country) in stationCountByCountry"
        :key="country"
        cols="3"
        class="pa-0"
      >
        <v-checkbox
          v-model="selected"
          class="ma-0 countryswitch"
          :label="getLabel(country, count)"
          :value="country"
          dense
          @click.native="boxClick"
        />
      </v-col>
    </v-row>

    <v-alert
      v-if="!!errorMsg"
      type="error"
      class="mt-3 mb-0"
    >
      {{ errorMsg }}
    </v-alert>

    <v-alert
      v-if="!!successMsg"
      type="success"
      class="mt-3 mb-0"
    >
      {{ successMsg }}
    </v-alert>

    <v-row justify="end">
      <v-col cols="auto">
        <v-btn
          color="primary"
          @click="send"
        >
          Save
        </v-btn>
      </v-col>
    </v-row>
  </v-container>
</template>

<script lang="ts">
import { Vue, Component } from 'nuxt-property-decorator'
import { User } from '../types/index'

@Component({})
export default class StationSettings extends Vue {
  private valid: boolean = true
  private errorMsg: string | null = null
  private successMsg: string | null = null
  private selected: string[] = []

  private getLabel (country: string, count: number) {
    return country + ' (' + count + ')'
  }

  private boxClick () {
    this.errorMsg = null
    this.successMsg = null
  }

  mounted () {
    const user: User = this.$store.getters.user
    if (!user.countries || user.countries.length === 0) {
      return
    }
    user.countries.forEach(country => this.selected.push(country))
  }

  get stationCountByCountry () {
    const all: any = this.$store.getters.stationCountByCountry

    if (!all || all.length === 0) {
      return {}
    }

    const keys: string[] = Object.keys(all)
    const sortedkeys = keys.sort()
    const sorted: any = {}

    sortedkeys.forEach((value) => { sorted[value] = all[value] })

    return sorted
  }

  get countSelected () {
    const byCountry = this.stationCountByCountry
    const keys: string[] = Object.keys(byCountry)
    let sum = 0

    keys.forEach((value) => {
      if (this.selected.includes(value)) {
        sum += byCountry[value]
      }
    })

    return sum
  }

  public async send () {
    this.errorMsg = null
    this.successMsg = null

    try {
      await this.$store.dispatch('saveuserstations', this.selected)
    } catch (e) {
      this.errorMsg = e.message
      return
    }

    this.successMsg = 'Selection of stations saved successfully'
  }
}
</script>

<style>
#stationselect-row {
  max-height: 500px;
  overflow-y: auto;
  padding-left: 10px;
}

.countryswitch .v-messages {
  min-height: 0;
}

.countryswitch .v-input__slot {
  margin: 0 !important;
}
</style>
