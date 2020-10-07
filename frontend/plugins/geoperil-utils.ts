export function toUtcTimeStr(
    datetime: Date,
    withDate: boolean = true,
    withSeconds: boolean = true
  ) {
    const date = datetime.getUTCFullYear().toString() + '/'
      + (datetime.getUTCMonth() + 1).toString().padStart(2, '0') + '/'
      + datetime.getUTCDate().toString().padStart(2, '0') + ' · '

    const seconds = ':' + datetime.getUTCSeconds().toString().padStart(2, '0')

    return (withDate ? date : '')
      + datetime.getUTCHours().toString().padStart(2, '0') + ':'
      + datetime.getUTCMinutes().toString().padStart(2, '0') +
      (withSeconds ? seconds : '')
  }
