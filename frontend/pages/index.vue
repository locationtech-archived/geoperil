import LoginForm from '../components/LoginForm.vue';
<template>
  <v-app>
    <AppBar />
    <v-main>
      <v-layout
        column
        align-center
      >
        <LoginForm v-if="!$store.state.authUser">
        </LoginForm>
        <Geoperil v-else>
        </Geoperil>
      </v-layout>
    </v-main>
  </v-app>
</template>

<script lang="ts">
import LoginForm from '../components/LoginForm.vue'
import AppBar from '../components/AppBar.vue'
import Geoperil from '../components/Geoperil.vue'

export default {
  components: {
    Geoperil,
    AppBar,
    LoginForm
  }
}
</script>
