<template>
  <v-row class="mt-3" justify="center">
    <v-col sm="4" md="4" lg="3">
      <DenseTextField
        :value="localtime"
        label="Local time"
      />
    </v-col>
    <v-col sm="4" md="4" lg="3">
      <DenseTextField
        :value="utctime"
        label="UTC time"
      />
    </v-col>
  </v-row>
</template>

<script lang="ts">
import { Vue, Component, Prop } from 'nuxt-property-decorator'
import { toUtcTimeStr } from '../plugins/geoperil-utils'
import DenseTextField from './DenseTextField.vue'

@Component({
  components: {
    DenseTextField,
  }
})
export default class CurrentTimeDisplay extends Vue {
  private localtime: string = ''
  private utctime: string = ''
  private timer: any = null

  mounted() {
    this.updateDateTime()
    this.timer = setInterval(this.updateDateTime, 1000)
  }

  beforeDestroy() {
    clearInterval(this.timer)
  }

  public updateDateTime() {
    const cur = new Date()
    this.localtime = cur.getFullYear().toString() + '/'
      + (cur.getMonth() + 1).toString().padStart(2, '0') + '/'
      + cur.getDate().toString().padStart(2, '0') + ' · '
      + cur.getHours().toString().padStart(2, '0') + ':'
      + cur.getMinutes().toString().padStart(2, '0') + ':'
      + cur.getSeconds().toString().padStart(2, '0')
    this.utctime = toUtcTimeStr(cur)
  }
}
</script>
