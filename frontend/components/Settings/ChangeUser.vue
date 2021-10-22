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
      Change user
    </v-expansion-panel-header>
    <v-expansion-panel-content>
      <UserListAutocomplete
        label="Select user"
        :selected-user.sync="selectedUser"
      />

      <v-form
        v-if="selectedUserObj"
        ref="form"
      >
        <v-select
          v-model="institution"
          label="Set institution"
          :items="selectInstitutionsArr"
          required
          dense
        />

        <v-text-field
          v-model="newPassword"
          label="Set password"
          clearable
          dense
          @change="successMsg = null"
        />

        <v-list
          subheader
          flat
        >
          <v-input class="pa-0" label="Permissions:" />
          <v-list-item-group
            class="listcolumngroup"
          >
            <v-list-item
              v-for="perm in supportedPermissions"
              :key="perm.id"
              class="pa-0 nocursor"
              :ripple="false"
              dense
            >
              <v-checkbox
                v-model="permissions[perm.id]"
                class="pa-0 ma-0"
                :label="perm.name"
              />
            </v-list-item>
          </v-list-item-group>
        </v-list>
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

      <v-row v-if="selectedUserObj" justify="end">
        <v-col cols="auto">
          <v-btn
            color="primary"
            @click="save"
          >
            Save
          </v-btn>
        </v-col>
      </v-row>
    </v-expansion-panel-content>
  </v-expansion-panel>
</template>

<script lang="ts">
import querystring from 'querystring'
import { Vue, Component, Watch } from 'nuxt-property-decorator'
import axios from 'axios'
import UserListAutocomplete from './UserListAutocomplete.vue'
import { Institution, User } from '~/types'
import {
  API_CHANGEUSER_URL,
  API_GET_SUPPORTED_PERMISSIONS_URL,
  FORM_ENCODE_CONFIG,
} from '~/store/constants'

@Component({
  components: {
    UserListAutocomplete,
  },
})
export default class ChangeUser extends Vue {
  private valid: boolean = true
  private institution: any | null = null
  private successMsg: string | null = null
  private errorMsg: string | null = null
  private newPassword: string | null = null
  private selectedUser: string | null = null
  private selectedUserObj: User | null = null
  private permissions: any | null = null
  private supportedPermissions: any[] | null = null

  mounted () {
    this.$store.dispatch('fetchAllUsers')
    this.fetchSupportedPermissions()
  }

  @Watch('selectedUser')
  private onSelectedUserChange () {
    this.selectedUserObj = null

    if (!this.selectedUser) {
      return
    }

    this.successMsg = null
    this.errorMsg = null

    const allusers = this.allUsers

    for (let i = 0; i < allusers.length; i++) {
      if (allusers[i].username === this.selectedUser) {
        this.selectedUserObj = allusers[i]
        break
      }
    }

    if (!this.selectedUserObj) {
      return
    }

    if (this.selectedUserObj.inst) {
      this.institution = this.selectedUserObj.inst.name
    }

    if (this.selectedUserObj.permissions) {
      this.permissions = { ...this.selectedUserObj.permissions }
    }
  }

  get allUsers () {
    return this.$store.getters.allUsers
  }

  get allInstitutions () {
    return this.$store.getters.allInstitutions
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

  async fetchSupportedPermissions () {
    const { data } = await axios.post(API_GET_SUPPORTED_PERMISSIONS_URL)

    if (
      !('status' in data) || data.status !== 'success' ||
      !('permissions' in data)
    ) {
      throw new Error('Invalid response from endpoint')
    }

    this.supportedPermissions = data.permissions
  }

  async save () {
    this.successMsg = null
    this.errorMsg = null

    if (!this.selectedUserObj || !this.supportedPermissions) {
      this.errorMsg = 'Internal error'
      return
    }

    const username = this.selectedUserObj.username
    const newPermissions: any = {}

    for (let i = 0; i < this.supportedPermissions.length; i++) {
      const perm = this.supportedPermissions[i]
      newPermissions[perm.id] = this.permissions[perm.id]
      if (!newPermissions[perm.id]) {
        // set to false for permissions which did not exist previously on the
        // user object (e.g. in case a new permission was implemented)
        newPermissions[perm.id] = false
      }
    }

    let extraInfo = 'Password was not changed.'

    if (this.newPassword) {
      extraInfo = 'Password was changed to \'' + this.newPassword + '\'.'
    }

    try {
      const updateObj = {
        username,
        password: this.newPassword,
        inst: this.institution,
        permissions: JSON.stringify(newPermissions),
      }

      const { data } = await axios.post(
        API_CHANGEUSER_URL,
        querystring.stringify(updateObj),
        FORM_ENCODE_CONFIG
      )

      if (
        'status' in data && data.status === 'success' &&
        'user' in data && 'username' in data.user &&
        data.user.username === username
      ) {
        this.successMsg = 'User with username \'' + username +
          '\' changed successfully. ' + extraInfo
        this.selectedUser = null
        this.selectedUserObj = null
        this.newPassword = null
        await this.$store.dispatch('fetchAllUsers')
      } else {
        this.errorMsg = 'User could not be changed. ' +
          (('errors' in data) ? data.errors.toString() : '')
      }
    } catch (e) {
      this.errorMsg = e.message
    }
  }
}
</script>

<style>
.listcolumngroup {
  max-height: 400px;
  display: flex;
  flex-flow: column wrap;
}

.nocursor {
  cursor: auto !important;
}
</style>
