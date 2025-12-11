import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import { Layout, Form, Input, Pagination, Card, Flex, Button, Typography, Tag } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { getNotePage } from '@/api/note'

export default function Page({}) {
  const [list, setList] = useState([])
  const [form] = Form.useForm()
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
  })
  const [total, setTotal] = useState(0)
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
            style={{ marginRight: idx === item.keywords.length - 1 ? 0 : 8 }}>
            {keyword}
          </Tag>
        ))
      : []
    return (
      <Link
        key={item.id}
        to={`/note/edit/${item.id}`}>
        <Card
          key={item.id}
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
              <Typography.Title
                level={3}
                style={{ margin: 0 }}>
                {item.title || '未命名记录'}
              </Typography.Title>
              <Typography.Text type="secondary">{item.createdAt}</Typography.Text>
              <Typography.Paragraph style={{ margin: 0 }}>{item.description || '这是一个记录'}</Typography.Paragraph>
              <Flex
                wrap
                gap="small">
                {tagList}
              </Flex>
            </Flex>
          </Flex>
        </Card>
      </Link>
    )
  })

  const fetch = async () => {
    const [err, res] = await getNotePage({
      page: pagination.page,
      pageSize: pagination.pageSize,
      ...form.getFieldsValue(),
    })
    if (res) {
      setList(res.data.rows)
      setTotal(res.data.total)
    }
  }

  const handlePage = (page, pageSize) => {
    setPagination({
      page: page || 1,
      pageSize: pageSize || pagination.pageSize,
    })
    fetch()
  }

  useEffect(() => {
    fetch()
  }, [])

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
      <Form
        layout="inline"
        form={form}
        style={{
          marginBottom: '16px',
          justifyContent: 'flex-end',
        }}>
        <Form.Item name="keyword">
          <Input
            allowClear
            placeholder="请输入关键词"
          />
        </Form.Item>
        <Form.Item>
          <Button
            onClick={() => handlePage(1)}
            type="primary">
            <SearchOutlined />
          </Button>
        </Form.Item>
      </Form>
      {cardList}
      <Pagination
        align="end"
        current={pagination.page}
        pageSize={pagination.pageSize}
        defaultCurrent={1}
        defaultPageSize={10}
        showTotal={showTotal}
        total={total}
        onChange={handlePage}
      />
    </Layout.Content>
  )
}
