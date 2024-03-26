
import path from 'path';
import { defineConfig } from 'vite';

const BASE_DIR = __dirname;

const viteConfig = {
  build: {
    lib: {
      entry: path.resolve(BASE_DIR, './src/main.ts'),
      name: 'sysmon-ts',
      fileName: 'index',
    },
  },
  test: {
    environment: 'node',
    include: [
      './src/**/*.{test,spec}.{js,ts}',
    ],
    reporters: [
      'default',
      'junit',
    ],
    outputFile: {
      junit: './test-reports/junit.xml',
    },
    coverage: {
      include: [
        'src/**/*.{js,ts}',
      ],
      exclude: [

      ],
      all: true,
      provider: 'istanbul',
      reporter: [
        'text',
        'cobertura',
        'html',
      ]
    }
  },
};

export default defineConfig(viteConfig);
