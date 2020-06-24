<template>
  <v-container>
    <h1>logged in</h1>
    <p>Hello {{ $store.state.authUser.username }}!</p>
  </v-container>
</template>

<script lang="ts">
import { Vue, Component } from 'nuxt-property-decorator'

@Component
export default class Geoperil extends Vue {
}
</script>
