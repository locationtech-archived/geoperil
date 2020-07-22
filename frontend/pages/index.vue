import LoginForm from '../components/LoginForm.vue';
<template>
  <v-app>
    <AppBar />
    <v-main>
      <v-container
        id="main-container"
        class="ma-0 pa-0"
        align-center
        fluid
      >
        <LoginForm v-if="!$store.state.authUser">
        </LoginForm>
        <Geoperil v-else>
        </Geoperil>
      </v-container>
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

<style>
#main-container {
  height: calc(100vh - 64px);
}
</style>
