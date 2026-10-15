import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['./test/setup.js'],
    testTimeout: 10000,
    hookTimeout: 30000,
    // 串行执行测试文件，避免数据库并发问题
    fileParallelism: false,
  }
})
