
import { File, Suite, Task, Test } from 'vitest';

export type TaskMocks = {
  file: File;
  suite: Suite;
  test: Task;
  failedTest: Task;
};

export function getTaskMocks(opts: {
  projectName: string;
  filepath: string;
}): TaskMocks {
  let taskMocks: TaskMocks;
  let fileMock: File;
  let suiteMock: Suite;
  let testMock: Task;
  let failTestMock: Task;
  fileMock = {
    type: 'suite',
    id: 'mock_file_id',
    filepath: '/path/to/file/mock_file',
    projectName: opts.projectName,
    name: 'mock_file',
    tasks: [],
    mode: 'run',
    result: {
      state: 'pass',
    },
    meta: {},
  };
  suiteMock = {
    type: 'suite',
    id: 'mock_suite_id',
    file: fileMock,
    filepath: opts.filepath,
    projectName: opts.projectName,
    name: 'suite_mock_name',
    tasks: [],
    mode: 'run',
    result: {
      state: 'pass',
      duration: 5,
    },
    meta: {},
  };
  fileMock.tasks.push(suiteMock);
  testMock = {
    type: 'test',
    id: 'mock_test_id',
    context: undefined as unknown as Test['context'],
    suite: suiteMock,
    file: fileMock,
    name: 'mock_test',
    mode: 'run',
    result: {
      state: 'pass',
    },
    meta: {},
  };
  failTestMock = {
    type: 'test',
    id: 'mock_failed_test_id',
    context: undefined as unknown as Test['context'],
    suite: suiteMock,
    file: fileMock,
    name: 'mock_failed_test',
    mode: 'run',
    result: {
      state: 'fail',
    },
    meta: {},
  };
  suiteMock.tasks.push(testMock);
  suiteMock.tasks.push(failTestMock);
  taskMocks = {
    file: fileMock,
    suite: suiteMock,
    test: testMock,
    failedTest: failTestMock,
  };
  return taskMocks;
}
