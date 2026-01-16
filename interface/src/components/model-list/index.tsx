import { useState, useEffect } from 'react'
import { Space, Card, Switch, Drawer, Form, Input, Button } from 'antd'
import { SettingOutlined } from '@ant-design/icons'
import { getModelConfigGroup, createModelConfig, updateModelConfig } from '@/api/setting'

export function ModelConfigPanel({ data = null }) {
  return <></>
}

export default function ModelList({ editable = false, selectHander = () => {} }) {
  const [modelConfigList, setModelConfigList] = useState({})

  const modelConfigGroup = Object.entries(modelConfigList).map(([provider, list]) => {
    if (!list.length) return null
    const modelList = list.map((item) => {
      return (
        <Card
          style={{ width: 200 }}
          onClick={selectHander}
          actions={
            editable
              ? [
                  <SettingOutlined key="setting" />,
                  <Switch
                    size="small"
                    value={item.isActive}
                    onChange={(checked) => {
                      const copy = JSON.parse(JSON.stringify(modelConfigList))
                      let flag = false
                      for (const key in copy) {
                        const list = copy[key]
                        list.forEach((i) => {
                          if (i.id === item.id) {
                            i.isActive = checked
                            flag = true
                          }
                        })
                        if (flag) break
                      }
                      flag && setModelConfigList(copy)
                    }}
                  />,
                ]
              : null
          }>
          <Card.Meta title={item.modelName} />
        </Card>
      )
    })
    return (
      <>
        <h3 className="my-4 text-xl font-bold">{provider} </h3>
        <Space
          size={[8, 16]}
          wrap>
          {modelList}
        </Space>
      </>
    )
  })

  const fetchModelConfigGroup = async () => {
    const [err, res] = await getModelConfigGroup()
    console.log('[API]::[fetchModelConfigGroup]::', res, err)
    if (res) {
      return res.data || {}
    }
    return []
  }

  useEffect(() => {
    fetchModelConfigGroup().then((res) => {
      setModelConfigList(res)
    })
  }, [])

  return (
    <>
      {modelConfigGroup}
      <ModelConfigPanel data={} />
    </>
  )
}
