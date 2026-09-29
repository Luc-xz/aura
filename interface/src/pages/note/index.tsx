import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { App, Button, Card, Empty, Flex, Form, Input, Layout, Pagination, Segmented, Select, Space, Tag, Typography } from 'antd'
import { AppstoreOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { getNotePage } from '@/api/note'
import { getWorkspaceList } from '@/api/workspace'
import { formatRelative } from '@/utils/time'

const PAGE_SIZE = 10

const fetch = async (payload = { page: 1, pageSize: PAGE_SIZE }) => {
  const [err, res] = await getNotePage(payload)
  if (res) {
    return res.data
  }
  return null
}

export async function clientLoader() {
  const [data, [wsErr, wsRes]] = await Promise.all([fetch(), getWorkspaceList()])
  return {
    list: data?.rows || [],
    total: data?.total || 0,
    workspaces: wsRes?.data || [],
  }
}

export default function Page({ loaderData }) {
  const navigate = useNavigate()
  const { message } = App.useApp()

  const [list, setList] = useState(loaderData.list)
  const [total, setTotal] = useState(loaderData.total)
  const [workspaceId, setWorkspaceId] = useState<number | undefined>()
  const [sortKey, setSortKey] = useState('created_at')
  const [page, setPage] = useState(1)
  const [form] = Form.useForm()

  const load = async (opts?: { page?: number; workspaceId?: number; sortKey?: string; keyword?: string }) => {
    const next = {
      page: opts?.page ?? page,
      pageSize: PAGE_SIZE,
      orderBy: opts?.sortKey ?? sortKey,
      orderDir: 'DESC',
      workspaceId: opts?.workspaceId ?? workspaceId,
      keyword: opts?.keyword ?? form.getFieldValue('keyword'),
    }
    const data = await fetch(next)
    setList(data?.rows || [])
    setTotal(data?.total || 0)
    setPage(next.page)
  }

  // 常用标签点击筛选：复用关键词搜索（后端 title/description/keywords LIKE）
  const handleTagSearch = (keyword: string) => {
    form.setFieldsValue({ keyword })
    load({ page: 1, keyword })
    message.success(`已按「${keyword}」筛选`)
  }

  const showTotal = (total: number, range: [number, number]) => {
    return `${range[0]}-${range[1]} of ${total} items`
  }

  const cardList = list.map((item) => {
    const tagList = item.keywords
      ? item.keywords.map((keyword, idx) => (
          <Tag
            key={keyword}
            color="blue"
            variant="outlined"
            className="cursor-pointer"
            style={{ marginRight: idx === item.keywords.length - 1 ? 0 : 8 }}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              handleTagSearch(keyword)
            }}>
            {keyword}
          </Tag>
        ))
      : []
    return (
      <Link
        key={item.id}
        to={`/note/edit/${item.id}`}>
        <Card
          hoverable
          style={{
            width: '100%',
            marginBottom: 16,
          }}
          styles={{ body: { padding: 0, height: 180, overflow: 'hidden' } }}>
          <Flex justify="space-between">
            <img
              draggable={false}
              alt="avatar"
              src={item.cover || 'https://zos.alipayobjects.com/rmsportal/jkjgkEfvpUPVyRjUImniVslZfWPnJuuZ.png'}
              style={{
                display: 'block',
                height: 180,
              }}
            />
            <Flex
              vertical
              align="flex-end"
              justify="space-between"
              style={{ padding: 16 }}>
              <Space direction="vertical" size={4}>
                {item.workspaceTitle ? (
                  <Tag
                    color="geekblue"
                    icon={<AppstoreOutlined />}
                    className="m-0">
                    {item.workspaceTitle}
                  </Tag>
                ) : (
                  <span className="text-xs text-gray-400">未关联项目</span>
                )}
                <Typography.Title
                  level={3}
                  style={{ margin: 0 }}>
                  {item.title || '未命名记录'}
                </Typography.Title>
              </Space>
              <Typography.Text type="secondary">编辑于 {formatRelative(item.updatedAt)}</Typography.Text>
              <Typography.Paragraph style={{ margin: 0 }}>{item.description || '这是一个记录'}</Typography.Paragraph>
              <Flex
                wrap
                gap="small"
                justify="flex-end">
                {tagList}
              </Flex>
            </Flex>
          </Flex>
        </Card>
      </Link>
    )
  })

  return (
    <Layout.Content
      style={{
        padding: '48px 64px',
        margin: '0 auto',
        width: '100%',
        maxWidth: '1200px',
        height: '100%',
        overflow: 'auto',
      }}>
      <Flex
        justify="space-between"
        align="center"
        style={{ marginBottom: 16 }}>
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/note/edit')}>
            新建笔记
          </Button>
          <Select
            allowClear
            placeholder="所属项目"
            style={{ width: 180 }}
            value={workspaceId}
            options={loaderData.workspaces.map((item) => ({ value: item.id, label: item.title }))}
            onChange={(value) => {
              setWorkspaceId(value)
              load({ page: 1, workspaceId: value })
            }}
          />
          <Segmented
            options={[
              { label: '全部', value: 'created_at' },
              { label: '最近编辑', value: 'updated_at' },
            ]}
            value={sortKey}
            onChange={(value) => {
              setSortKey(value as string)
              load({ page: 1, sortKey: value as string })
            }}
          />
        </Space>
        <Form
          layout="inline"
          form={form}>
          <Form.Item name="keyword">
            <Input
              allowClear
              placeholder="请输入关键词"
              style={{ width: 200 }}
            />
          </Form.Item>
          <Form.Item>
            <Button
              onClick={() => load({ page: 1 })}
              type="primary">
              <SearchOutlined />
            </Button>
          </Form.Item>
        </Form>
      </Flex>
      {list.length ? (
        cardList
      ) : (
        <div className="flex justify-center py-20">
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无笔记，点击右上角新建一条"
          />
        </div>
      )}
      <Pagination
        align="end"
        current={page}
        pageSize={PAGE_SIZE}
        showTotal={showTotal}
        total={total}
        onChange={(nextPage) => load({ page: nextPage })}
      />
    </Layout.Content>
  )
}
