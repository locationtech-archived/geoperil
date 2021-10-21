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
  <v-form
    id="usersettings-form"
    ref="form"
    v-model="valid"
    class="pa-3"
  >
    <v-text-field
      v-model="username"
      label="Username"
      readonly
      disabled
    />

    <h4>Change your password:</h4>

    <v-text-field
      v-model="currentpass"
      type="password"
      :rules="validCurrentpass"
      label="Current password"
      required
      @change="successMsg = null"
    />

    <v-text-field
      v-model="newpass"
      type="password"
      :rules="validNewpass"
      label="New password"
      required
      @change="successMsg = null"
    />

    <v-text-field
      v-model="confirmpass"
      type="password"
      label="Confirm password"
      :rules="validConfirmpass"
      required
      @change="successMsg = null"
    />

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
          Save
        </v-btn>
      </v-col>
    </v-row>
  </v-form>
</template>

<script lang="ts">
import { Vue, Component } from 'nuxt-property-decorator'
import { User } from '~/types'

@Component({})
export default class UserSettings extends Vue {
  private valid: boolean = true
  private errorMsg: string | null = null
  private successMsg: string | null = null
  private currentpass: string = ''
  private newpass: string = ''
  private confirmpass: string = ''

  private validCurrentpass: Function[] = [
    (v: any) => !!v || 'Current password is required',
  ]

  private validNewpass: Function[] = [
    (v: any) => !!v || 'New password is required',
  ]

  private validConfirmpass: Function[] = [
    (v: any) => !!v || 'Repeat the new password for confirmation',
  ]

  get username () {
    const user: User = this.$store.getters.user
    return user.username
  }

  get isValid (): boolean {
    this.errorMsg = null

    if (
      !this.currentpass || this.currentpass.length === 0 ||
      !this.newpass || this.newpass.length === 0 ||
      !this.confirmpass || this.confirmpass.length === 0
    ) {
      return false
    }

    if (this.confirmpass !== this.newpass) {
      this.errorMsg = 'Passwords are not the same'
      return false
    }

    return true
  }

  public async send () {
    this.errorMsg = null
    this.successMsg = null

    const f: any = this.$refs.form

    try {
      await this.$store.dispatch(
        'changePassword',
        {
          curpwd: this.currentpass,
          newpwd: this.newpass,
        }
      )
    } catch (e) {
      this.errorMsg = e.message
      return
    }

    this.currentpass = ''
    this.newpass = ''
    this.confirmpass = ''
    this.successMsg = 'Changing the password was successful'
    f.resetValidation()
  }
}
</script>

<style>
#usersettings-form {
  height: 100%;
  overflow-y: auto;
}
</style>
