import ModelList from '@/components/model-list'
import { Layout } from 'antd'

export default function Page() {
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
      <ModelList editable />
    </Layout.Content>
  )
}
