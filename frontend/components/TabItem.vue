<template>
  <v-tab-item
    :transition="false"
    :reverse-transition="false"
  >
    <slot />
  </v-tab-item>
</template>

<script lang="ts">
import { Vue, Component } from 'nuxt-property-decorator'

@Component
export default class TabItem extends Vue {
}
</script>
