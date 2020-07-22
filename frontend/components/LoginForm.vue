<template>
  <v-row
    justify="center"
  >
    <v-card
      id="login-form-card"
      min-width="400"
    >
      <v-card-title class="headline">Login</v-card-title>
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
          >
          </v-text-field>

          <v-text-field
            v-model="formPassword"
            type="password"
            label="Password"
            name="password"
            :rules="passwordRules"
            required
          >
          </v-text-field>

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

  public async login() {
    try {
      await this.$store.dispatch('login', {
        username: this.formUsername,
        password: this.formPassword
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

<style>
#login-form-card {
  margin-top: 30px;
}
</style>
