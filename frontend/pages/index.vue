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
        <LoginForm v-if="!$store.state.user">
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
import { Vue, Component } from 'nuxt-property-decorator'

@Component({
  components: {
    Geoperil,
    AppBar,
    LoginForm
  }
})
export default class Index extends Vue {
}
</script>

<style>
#main-container {
  height: calc(100vh - 50px);
}
</style>
