<template>
  <v-toolbar
    color="#f5f5f5"
    height="50px"
    dense
  >
    <v-toolbar-title>GeoPeril - {{ title }}</v-toolbar-title>
    <v-spacer />
    <v-tooltip bottom>
      <template v-slot:activator="{ on, attrs }">
        <v-btn
          icon
          v-bind="attrs"
          class="mr-9"
          v-on="on"
          @click.native="closeAction"
        >
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </template>
      <span>Close</span>
    </v-tooltip>
  </v-toolbar>
</template>

<script lang="ts">
import { Vue, Component, Prop } from 'nuxt-property-decorator'

@Component({})
export default class DialogToolbar extends Vue {
  @Prop({ type: String, required: true }) title!: string
  @Prop({ type: Function, required: true }) closeAction!: Function
}
</script>
