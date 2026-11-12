import {Heading, LinkButton, Text} from '@primer/react'

export default function App() {
  return (
    <main className="mx-auto flex min-h-svh max-w-3xl flex-col items-start justify-center gap-4 px-6 py-12">
      <Heading as="h1" variant="large">项目模板</Heading>
      <Text as="p">项目已就绪，可以开始开发。</Text>
      <LinkButton href="/api/health" variant="primary">查看服务状态</LinkButton>
    </main>
  )
}
