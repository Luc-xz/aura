export const toCamelCase = (str) => {
  return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase())
}

export const toSnakeCase = (str) => {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase()
}

// AKA traversal toCamelCase
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
    return data.toISOString()
  }
  return data
}

export const toTree = (list, options = {}) => {
  const { idKey = 'id', parentKey = 'parentId', childrenKey = 'children' } = options

  const map = {}
  const tree = []

  list.forEach(node => {
    map[node[idKey]] = { ...node, [childrenKey]: [] }
  })

  list.forEach(node => {
    const current = map[node[idKey]]
    const parentId = node[parentKey]
    if (parentId && map[parentId]) {
      map[parentId][childrenKey].push(current)
    } else {
      tree.push(current) // 无父节点 → 顶级
    }
  })

  const prune = (nodes) => {
    nodes.forEach(n => {
      if (n[childrenKey].length === 0) {
        delete n[childrenKey]
      } else {
        prune(n[childrenKey])
      }
    })
  }
  prune(tree)

  return tree
}