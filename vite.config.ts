
import path from 'path';
import { defineConfig } from 'vite';

const BASE_DIR = __dirname;

export default defineConfig((config) => {
  return {
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
        // './src/test/reporters/ezd-reporter.ts',
        'default',
        // 'verbose',
        // 'junit',
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
          // 'text',
          'cobertura',
          'html',
        ]
      },
      // poolOptions: {
      //   // maxThreads: 20,
      //   // minThreads: 20,
      // },
    },
  };
});
