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
  <v-row
    justify="center"
  >
    <v-card
      class="mt-10"
      min-width="400"
    >
      <v-card-title class="headline">
        Login
      </v-card-title>
      <v-card-text>
        <v-form
          id="login-form"
          ref="form"
          v-model="valid"
          @submit.prevent="login"
        >
          <v-alert v-if="formError" type="error">
            {{ formError }}
          </v-alert>

          <v-text-field
            v-model="formUsername"
            label="E-Mail"
            name="username"
            :rules="nameRules"
            required
          />

          <v-text-field
            v-model="formPassword"
            type="password"
            label="Password"
            name="password"
            :rules="passwordRules"
            required
          />

          <v-btn
            type="submit"
            :disabled="!valid"
            color="success"
          >
            Login
          </v-btn>
        </v-form>
      </v-card-text>
    </v-card>
  </v-row>
</template>

<script lang="ts">
import { Vue, Component } from 'nuxt-property-decorator'

@Component
export default class LoginForm extends Vue {
  private nameRules: any = [
    (v: any) => !!v || 'Name is required',
  ]

  private passwordRules: any = [
    (v: any) => !!v || 'Password is required',
  ]

  private valid: boolean = false
  private formError: any = null
  private formUsername: string = ''
  private formPassword: string = ''

  public async login () {
    try {
      await this.$store.dispatch('login', {
        username: this.formUsername,
        password: this.formPassword,
      })
      this.formUsername = ''
      this.formPassword = ''
      this.formError = null
    } catch (e) {
      this.formError = e.message
    }
  }
}
</script>
