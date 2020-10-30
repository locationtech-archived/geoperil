<template>
  <v-row
    class="dialog-row fill-height ma-0 pa-0"
    justify="center"
  >
    <slot />
  </v-row>
</template>

<script lang="ts">
import { Vue, Component } from 'nuxt-property-decorator'

@Component
export default class DialogRow extends Vue {
}
</script>

<style>
.dialog-row {
  height: calc(100vh - 50px);
  background-color: white;
  overflow-y: auto;
}
</style>
