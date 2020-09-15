<template>
  <v-container>
    <h4 class="mb-2">Select your countries of interest:</h4>
    <v-row
      justify="start"
      id="stationselect-row"
      no-gutters
      dense
    >
      <v-col
        cols="3"
        class="pa-0"
        v-for="(count, country) in allStationsByCountry"
        :key="country"
      >
        <v-checkbox
          class="ma-0 countryswitch"
          :label="getLabel(country, count)"
          dense
        />
      </v-col>
    </v-row>

    <v-row no-gutters dense>
      <v-alert
        type="error"
        v-if="!!errorMsg"
      >
        {{ errorMsg }}
      </v-alert>

      <v-alert
        type="success"
        v-if="!!successMsg"
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
    </v-row>
  </v-container>
</template>

<script lang="ts">
import { Vue, Component } from 'nuxt-property-decorator'
import { User, Station } from '../types/index'

@Component({})
export default class StationSettings extends Vue {
  private valid: boolean = true
  private errorMsg: string | null = null
  private successMsg: string | null = null

  private getLabel(country: string, count: number) {
    return country + " (" + count + ")"
  }

  get allStationsByCountry() {
    const all: Station[] = this.$store.getters.allStations

    if (!all || all.length == 0) {
      return {}
    }

    var bycountry = {}
    var countrynames = []

    for (let i = 0; i < all.length; i++) {
      const name = all[i].country
      if (!(name in bycountry)) {
        bycountry[name] = 1
        countrynames.push(name)
      } else {
        bycountry[name]++
      }
    }

    countrynames.sort()
    var sorted = {}

    for (let i = 0; i < countrynames.length; i++) {
      const name = countrynames[i]
      sorted[name] = bycountry[name]
    }

    return sorted
  }

  public async send() {
    this.errorMsg = null
    this.successMsg = null

    const f: any = this.$refs.form

    try {
      // TODO: await this.$store.dispatch('', {})
    } catch (e) {
      this.errorMsg = e.message
      return
    }

    f.resetValidation()
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
