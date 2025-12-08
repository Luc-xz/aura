export const formatDate = (date) => {
  const d = new Date(date)
  const zerofill = n => n > 9 ? n : `0${n}`
  const year = d.getFullYear()
  const month = zerofill(d.getMonth() + 1)
  const day = zerofill(d.getDate())
  const hours = zerofill(d.getHours())
  const minutes = zerofill(d.getMinutes())
  const seconds = zerofill(d.getSeconds())
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

export const toCamelCase = (str) => {
  return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase())
}

export const formatResponse = (data) => {
  if (Array.isArray(data)) {
    return data.map(item => formatResponse(item))
  } else if (data !== null && typeof data === 'object' && !(data instanceof Date)) {
    const newObj = {}
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const newKey = toCamelCase(key)
        newObj[newKey] = formatResponse(data[key])
      }
    }
    return newObj
  } else if (data instanceof Date) {
    return formatDate(data)
  }
  return data
}
