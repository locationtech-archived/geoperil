<template>
  <v-expansion-panel>
    <v-expansion-panel-header>
      Add a user
    </v-expansion-panel-header>
    <v-expansion-panel-content>
      <v-form
        v-model="valid"
        ref="form"
      >
        <v-text-field
          v-model="addUsername"
          ref="refUsername"
          label="Username"
          :rules="validNewUsername"
          @change="successMsg = null"
          required
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
          ref="refInitialPassword"
          label="Initial password for first login"
          class="initial-pwd-textfield"
          append-outer-icon="mdi-reload"
          :rules="validInitialPassword"
          @click:append-outer="generateInitialPassword"
          @change="successMsg = null"
          clearable
          required
        />
      </v-form>

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
import { Vue, Component } from 'nuxt-property-decorator'
import { User, Institution } from '../types/index'
import axios from 'axios'
import { API_REGISTERUSER_URL, FORM_ENCODE_CONFIG } from '../store/constants'
import querystring from 'querystring'

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

  mounted() {
    this.generateInitialPassword()
  }

  public generateInitialPassword() {
    this.initialPassword = Math.random().toString(36).slice(-8)
  }

  get isValid(): boolean {
    this.errorMsg = null

    if (
      !this.addUsername || this.addUsername.length == 0
      || !this.initialPassword || this.initialPassword.length == 0
      || !this.selectedInstitution
    ) {
      return false
    }

    if (false) {
      // check if valid characters in username
      this.errorMsg = 'Passwords are not the same'
      return false
    }

    return true
  }

  get selectInstitutionsArr() {
    const all: Institution[] = this.$store.getters.allInstitutions

    if (!all || all.length == 0) {
      return []
    }

    var arr = []

    for (let i = 0; i < all.length; i++) {
      arr.push(all[i].name)
    }

    return arr
  }

  async send() {
    const f: any = this.$refs.form
    this.successMsg = null
    this.errorMsg = null

    try {
      var { data } = await axios.post(
        API_REGISTERUSER_URL,
        querystring.stringify({
          username: this.addUsername,
          password: this.initialPassword,
          inst: this.selectedInstitution,
        }),
        FORM_ENCODE_CONFIG
      )
    } catch (e) {
      this.errorMsg = e.message
      return
    }

    if (
      'status' in data && data.status == "success"
      && 'user' in data && 'username' in data.user
      && data.user.username == this.addUsername
    ) {
      this.successMsg = 'A user with username \'' + this.addUsername
        + '\' was created. '
        + 'The user has the following initial password: ' + this.initialPassword

      this.addUsername = null
      this.initialPassword = null
      this.selectedInstitution = null
      f.resetValidation()
    } else {
      this.errorMsg = 'User could not be created. '
        + (('errors' in data) ? data.errors.toString() : '')
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
