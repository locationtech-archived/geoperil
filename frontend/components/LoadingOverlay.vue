<template>
  <v-layout row justify-center>
    <v-dialog
      v-model="isLoading"
      content-class="loading-dialog"
      transition=""
      fullscreen
      persistent
    >
      <v-container fill-height>
        <v-layout row justify-center align-center>
          <v-progress-circular
            :indeterminate="isLoading"
            size="64"
            width="7"
            color="primary"
          />
        </v-layout>
      </v-container>
    </v-dialog>
  </v-layout>
</template>

<script lang="ts">
import { Vue, Component, Prop } from 'nuxt-property-decorator'

@Component({})
export default class LoadingOverlay extends Vue {
  @Prop({ type: Boolean, default: false }) isLoading!: Boolean
}
</script>

<style>
.loading-dialog {
  background-color: black;
  opacity: 0.3;
}
</style>
