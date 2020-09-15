<template>
  <v-form
    class="pa-3"
    id="usersettings-form"
    ref="form"
    v-model="valid"
  >
    <v-text-field
      v-model="username"
      ref="refUsername"
      label="Username"
      readonly
      disabled
    />

    <h3>Change your password:</h3>

    <v-text-field
      type="password"
      v-model="currentpass"
      :rules="validCurrentpass"
      label="Current password"
      @change="successMsg = null"
      required
    />

    <v-text-field
      type="password"
      v-model="newpass"
      :rules="validNewpass"
      label="New password"
      @change="successMsg = null"
      required
    />

    <v-text-field
      type="password"
      v-model="confirmpass"
      label="Confirm password"
      :rules="validConfirmpass"
      @change="successMsg = null"
      required
    />

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
          Save
        </v-btn>
      </v-col>
    </v-row>
  </v-form>
</template>

<script lang="ts">
import { Vue, Component } from 'nuxt-property-decorator'
import { User } from '../types/index'

@Component({})
export default class UserSettings extends Vue {
  private valid: boolean = true
  private errorMsg: string | null = null
  private successMsg: string | null = null
  private currentpass: string = ""
  private newpass: string = ""
  private confirmpass: string = ""

  private validCurrentpass: Function[] = [
    (v: any) => !!v || 'Current password is required',
  ]

  private validNewpass: Function[] = [
    (v: any) => !!v || 'New password is required',
  ]

  private validConfirmpass: Function[] = [
    (v: any) => !!v || 'Repeat the new password for confirmation',
  ]

  get username() {
    const user: User = this.$store.getters.user
    return user.username
  }

  get isValid(): boolean {
    this.errorMsg = null

    if (
      !this.currentpass || this.currentpass.length == 0
      || !this.newpass || this.newpass.length == 0
      || !this.confirmpass || this.confirmpass.length == 0
    ) {
      return false
    }

    if (this.confirmpass != this.newpass) {
      this.errorMsg = 'Passwords are not the same'
      return false
    }

    return true
  }

  public async send() {
    this.errorMsg = null
    this.successMsg = null

    const f: any = this.$refs.form

    try {
      await this.$store.dispatch(
        'changePassword',
        {
          curpwd: this.currentpass,
          newpwd: this.newpass
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
