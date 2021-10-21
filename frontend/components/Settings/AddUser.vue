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
  <v-expansion-panel>
    <v-expansion-panel-header>
      Add a user
    </v-expansion-panel-header>
    <v-expansion-panel-content>
      <v-form
        ref="form"
        v-model="valid"
      >
        <v-text-field
          v-model="addUsername"
          label="Username"
          :rules="validNewUsername"
          required
          @change="successMsg = null"
        />

        <v-select
          v-model="selectedInstitution"
          label="Select institution"
          :items="selectInstitutionsArr"
          :rules="validInstitution"
          required
        />

        <v-text-field
          v-model="initialPassword"
          label="Initial password for first login"
          class="initial-pwd-textfield"
          append-outer-icon="mdi-reload"
          :rules="validInitialPassword"
          clearable
          required
          @click:append-outer="generateInitialPassword"
          @change="successMsg = null"
        />
      </v-form>

      <v-alert
        v-if="!!errorMsg"
        type="error"
      >
        {{ errorMsg }}
      </v-alert>

      <v-alert
        v-if="!!successMsg"
        type="success"
      >
        {{ successMsg }}
      </v-alert>

      <v-row justify="end">
        <v-col cols="auto">
          <v-btn
            :disabled="!isValid"
            color="primary"
            @click="send"
          >
            Create user
          </v-btn>
        </v-col>
      </v-row>
    </v-expansion-panel-content>
  </v-expansion-panel>
</template>

<script lang="ts">
import querystring from 'querystring'
import { Vue, Component } from 'nuxt-property-decorator'
import axios from 'axios'
import { Institution } from '~/types'
import { API_REGISTERUSER_URL, FORM_ENCODE_CONFIG } from '~/store/constants'

@Component({})
export default class AddUser extends Vue {
  private valid: boolean = true
  private selectedInstitution: any | null = null
  private successMsg: string | null = null
  private errorMsg: string | null = null
  private addUsername: string | null = null
  private initialPassword: string | null = null

  private validNewUsername: Function[] = [
    (v: any) => !!v || 'A new username is required',
  ]

  private validInitialPassword: Function[] = [
    (v: any) => !!v || 'Initial password is required',
  ]

  private validInstitution: Function[] = [
    (v: any) => !!v || 'Institution is required',
  ]

  mounted () {
    this.generateInitialPassword()
  }

  public generateInitialPassword () {
    this.initialPassword = Math.random().toString(36).slice(-8)
  }

  get isValid (): boolean {
    this.errorMsg = null

    if (
      !this.addUsername || this.addUsername.length === 0 ||
      !this.initialPassword || this.initialPassword.length === 0 ||
      !this.selectedInstitution
    ) {
      return false
    }

    const re = /[A-Za-z.@]+/

    if (!re.test(this.addUsername)) {
      this.errorMsg = 'Invalid username'
      return false
    }

    return true
  }

  get selectInstitutionsArr () {
    const all: Institution[] = this.$store.getters.allInstitutions

    if (!all || all.length === 0) {
      return []
    }

    const arr = []

    for (let i = 0; i < all.length; i++) {
      arr.push(all[i].name)
    }

    return arr
  }

  async send () {
    const f: any = this.$refs.form
    this.successMsg = null
    this.errorMsg = null

    try {
      const { data } = await axios.post(
        API_REGISTERUSER_URL,
        querystring.stringify({
          username: this.addUsername,
          password: this.initialPassword,
          inst: this.selectedInstitution,
        }),
        FORM_ENCODE_CONFIG
      )

      if (
        'status' in data && data.status === 'success' &&
        'user' in data && 'username' in data.user &&
        data.user.username === this.addUsername
      ) {
        this.successMsg = 'A user with username \'' + this.addUsername +
          '\' was created. ' +
          'The user has the following initial password: ' + this.initialPassword

        this.addUsername = null
        this.initialPassword = null
        this.selectedInstitution = null
        f.resetValidation()
      } else {
        this.errorMsg = 'User could not be created. ' +
          (('errors' in data) ? data.errors.toString() : '')
      }
    } catch (e) {
      this.errorMsg = e.message
    }
  }
}
</script>

<style>
.initial-pwd-textfield button.mdi-reload:focus::after {
  opacity: 0;
}

.initial-pwd-textfield button.mdi-reload:hover::after {
  opacity: 0.16;
}
</style>
